import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { createClient } from '@/lib/supabase/server';
import type { UserType } from '@/lib/auth/types';
import { getUserType } from '@/lib/auth/types';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  ensureSupabaseUserExists,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { unstable_cache as cache } from 'next/cache';
import { fetchModels } from 'tokenlens/fetch';
import { getUsage } from 'tokenlens/helpers';
import type { ModelCatalog } from 'tokenlens/core';
import type { AppUsage } from '@/lib/usage';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        'TokenLens: catalog fetch failed, using default catalog',
        err,
      );
      return undefined; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ['tokenlens-catalog'],
  { revalidate: 24 * 60 * 60 }, // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userType: UserType = getUserType(user);

    // For guest users, we skip message count checking or use a default guest user ID
    let messageCount = 0;
    if (user) {
      messageCount = await getMessageCountByUserId({
        id: user.id,
        differenceInHours: 24,
      });
    }

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // For guest users, skip database operations entirely
    let chat = null;
    if (user) {
      try {
        // Ensure the Supabase user exists in our database
        await ensureSupabaseUserExists(user.id, user.email!);
        
        chat = await getChatById({ id });
      } catch (error) {
        console.error('Error getting chat by ID:', error);
        // Chat doesn't exist, we'll create it
      }

      if (!chat) {
        try {
          const title = await generateTitleFromUserMessage({
            message,
          });

          await saveChat({
            id,
            userId: user.id,
            title,
            visibility: selectedVisibilityType,
          });
        } catch (error) {
          console.error('Error saving chat:', error);
          throw error;
        }
      } else {
        // Check ownership for authenticated users
        if (chat.userId !== user.id) {
          return new ChatSDKError('forbidden:chat').toResponse();
        }
      }
    }

    // For guest users, start with empty message history
    const messagesFromDb = user ? await getMessagesByChatId({ id }) : [];
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Only save messages for authenticated users
    if (user) {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: 'user',
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const streamId = generateUUID();
    // Only create stream ID for authenticated users
    if (user) {
      await createStreamId({ streamId, chatId: id });
    }

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: [
            'getWeather',
            'createDocument',
            'updateDocument',
            'requestSuggestions',
          ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session: user ? { user } : undefined, dataStream }),
            updateDocument: updateDocument({ session: user ? { user } : undefined, dataStream }),
            requestSuggestions: requestSuggestions({
              session: user ? { user } : undefined,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({ type: 'data-usage', data: finalMergedUsage });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({ type: 'data-usage', data: finalMergedUsage });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            } catch (err) {
              console.warn('TokenLens enrichment failed', err);
              finalMergedUsage = usage;
              dataStream.write({ type: 'data-usage', data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        // Only save messages and usage for authenticated users
        if (user) {
          await saveMessages({
            messages: messages.map((message) => ({
              id: message.id,
              role: message.role,
              parts: message.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });

          if (finalMergedUsage) {
            try {
              await updateChatLastContextById({
                chatId: id,
                context: finalMergedUsage,
              });
            } catch (err) {
              console.warn('Unable to persist last usage for chat', id, err);
            }
          }
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // For authenticated users with saved stream IDs, use resumable streams
    if (streamContext && user) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      // For guest users or when resumable streams are not available, use regular streaming
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        'AI Gateway requires a valid credit card on file to service requests',
      )
    ) {
      return new ChatSDKError('bad_request:activate_gateway').toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
