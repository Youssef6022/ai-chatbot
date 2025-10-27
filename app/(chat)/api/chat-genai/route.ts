
import { createClient } from '@/lib/supabase/server';
import type { UserType } from '@/lib/auth/types';
import { getUserType } from '@/lib/auth/types';
import {
  deleteChatById,
  ensureSupabaseUserExists,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from '../chat/schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { genaiClient, getModelName, type ChatModelId } from '@/lib/ai/providers';

export const maxDuration = 60;

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
      groundingType = 'none',
      isReasoningEnabled = false,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      groundingType?: 'none' | 'search' | 'maps';
      isReasoningEnabled?: boolean;
    } = requestBody;

    if (!genaiClient) {
      return new Response('GenAI client not initialized', { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userType: UserType = getUserType(user);

    // Check rate limits for authenticated users
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

    // Get or create chat
    let chat = null;
    if (user) {
      try {
        await ensureSupabaseUserExists(user.id, user.email!);
        chat = await getChatById({ id });
      } catch (error) {
        console.error('Error getting chat by ID:', error);
      }

      if (!chat) {
        try {
          const firstMessageText = message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n');

          const title = await generateTitleFromUserMessage({ message });

          await saveChat({
            id,
            userId: user.id,
            title,
            visibility: selectedVisibilityType,
          });
        } catch (error) {
          console.error('Error creating chat:', error);
          await deleteChatById({ id });
          return new ChatSDKError('internal_server_error').toResponse();
        }
      }
    }

    // Get message history
    const messagesFromDb = user ? await getMessagesByChatId({ id }) : [];

    // Build conversation history for GenAI
    const history: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];

    for (const msg of messagesFromDb) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const parts: Array<any> = [];

        for (const p of msg.parts as any[]) {
          if (p.type === 'text') {
            parts.push({ text: p.text });
          } else if (p.type === 'file' && msg.role === 'user') {
            // Only include files in user messages (model doesn't send files)
            try {
              const response = await fetch(p.url);
              const arrayBuffer = await response.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');

              parts.push({
                inlineData: {
                  mimeType: p.mediaType || 'image/jpeg',
                  data: base64Data,
                },
              });
            } catch (error) {
              console.error('Error fetching file from history:', error);
              // Skip this file if fetch fails
            }
          }
        }

        if (parts.length > 0) {
          history.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts,
          });
        }
      }
    }

    // Prepare current message with both text and files
    const currentMessageParts: Array<any> = [];

    console.log('📨 Processing message parts:', message.parts.length);

    for (const part of message.parts) {
      if (part.type === 'text') {
        console.log('📝 Adding text part:', part.text.substring(0, 50));
        currentMessageParts.push({ text: part.text });
      } else if (part.type === 'file') {
        // Fetch the file data from the URL
        console.log('🖼️ Processing file:', part.url, 'mediaType:', part.mediaType);
        try {
          const response = await fetch(part.url);
          console.log('✅ Fetch response status:', response.status);

          if (!response.ok) {
            console.error('❌ Fetch failed with status:', response.status);
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength);

          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          console.log('🔐 Base64 data length:', base64Data.length);

          const imagePart = {
            inlineData: {
              mimeType: part.mediaType || 'image/jpeg',
              data: base64Data,
            },
          };

          currentMessageParts.push(imagePart);
          console.log('✅ Image part added successfully');
        } catch (error) {
          console.error('❌ Error fetching file:', error);
          // Continue without this file if fetch fails
        }
      }
    }

    console.log('📊 Total message parts prepared:', currentMessageParts.length);

    const currentMessageText = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');

    // Configure tools based on grounding type
    const tools: any[] = [];

    if (groundingType === 'search') {
      tools.push({ googleSearch: {} });
    } else if (groundingType === 'maps') {
      tools.push({ googleMaps: {} });
    }

    // Add weather tool (using automatic function calling)
    tools.push(getWeather);

    // Configure generation
    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    if (isReasoningEnabled) {
      config.thinkingConfig = {
        thinkingBudget: 8192,
        includeThoughts: true,
      };
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create chat with history
          const chat = genaiClient.chats.create({
            model: getModelName(selectedChatModel as ChatModelId),
            history: history,
            config: config,
          });

          // Send message and stream response
          // Use parts if there are files, otherwise use text
          const hasFiles = currentMessageParts.some((p: any) => p.inlineData);
          console.log('🚀 Sending to AI - hasFiles:', hasFiles, 'parts count:', currentMessageParts.length);

          const response = currentMessageParts.length > 1 || hasFiles
            ? await chat.sendMessageStream({
                message: currentMessageParts,
              })
            : await chat.sendMessageStream({
                message: currentMessageText,
              });

          console.log('✅ Message sent to AI, streaming response...');

          let fullText = '';
          const assistantMessageId = generateUUID();

          // Stream the response
          for await (const chunk of response) {
            if (chunk.text) {
              fullText += chunk.text;

              // Send text delta
              const data = {
                type: 'text-delta',
                textDelta: chunk.text,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }
          }

          // Save messages to database if user is authenticated
          if (user) {
            const dbMessages = [
              {
                id: message.id,
                chatId: id,
                role: 'user' as const,
                parts: message.parts,
                createdAt: new Date(),
              },
              {
                id: assistantMessageId,
                chatId: id,
                role: 'assistant' as const,
                parts: [{ type: 'text' as const, text: fullText }],
                createdAt: new Date(),
              },
            ];

            await saveMessages({ messages: dbMessages });

            // Update last context
            await updateChatLastContextById({
              id,
              lastContext: { modelId: selectedChatModel },
            });
          }

          // Send finish event
          const finishData = {
            type: 'finish',
            finishReason: 'stop',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishData)}\n\n`));

          controller.close();
        } catch (error: any) {
          console.error('GenAI streaming error:', error);
          const errorData = {
            type: 'error',
            error: error.message || 'Unknown error',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat GenAI API error:', error);
    return new ChatSDKError('internal_server_error').toResponse();
  }
}
