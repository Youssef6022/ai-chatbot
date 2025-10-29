
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
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from '../chat/schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { genaiClient, vertexAIClient, getModelName, type ChatModelId } from '@/lib/ai/providers';
import { logToFile, } from '@/lib/logger';

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
      groundingType?: 'none' | 'search' | 'maps' | 'rag-civil' | 'rag-commerce';
      isReasoningEnabled?: boolean;
    } = requestBody;

    await logToFile('📥 INCOMING REQUEST', {
      chatId: id,
      model: selectedChatModel,
      groundingType,
      isReasoningEnabled,
      message: message.parts.map(p => p.type === 'text' ? p.text : `[${p.type}]`).join(' '),
    });

    // Determine which client to use based on grounding type
    const isRAG = groundingType === 'rag-civil' || groundingType === 'rag-commerce';
    const activeClient = isRAG ? vertexAIClient : genaiClient;

    if (!activeClient) {
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
    let toolConfig: any = undefined;

    if (groundingType === 'search') {
      tools.push({ googleSearch: {} });
      await logToFile('🔍 Google Search tool added');
    } else if (groundingType === 'maps') {
      tools.push({ googleMaps: {} });

      // For Google Maps, we need to provide toolConfig with location context
      // Default location (Louvain-la-Neuve, Belgium)
      toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: 50.6686,
            longitude: 4.6111,
          },
          languageCode: 'fr-BE',
        },
      };

      await logToFile('📍 Google Maps tool added with toolConfig', toolConfig);
    } else if (groundingType === 'rag-civil' || groundingType === 'rag-commerce') {
      // RAG configuration with Vertex AI
      const ragCorpus = groundingType === 'rag-civil'
        ? 'projects/total-apparatus-451215-g1/locations/europe-west3/ragCorpora/3379951520341557248'
        : 'projects/total-apparatus-451215-g1/locations/europe-west3/ragCorpora/2842897264777625600';

      tools.push({
        retrieval: {
          vertex_rag_store: {
            rag_resources: [{
              rag_corpus: ragCorpus,
            }],
            similarity_top_k: 20,
          },
        },
      });

      await logToFile(`📚 RAG tool added (${groundingType === 'rag-civil' ? 'Code Civil' : 'Code Commerce'})`, {
        ragCorpus,
        similarityTopK: 20,
      });
    }

    // Note: Weather tool removed - it conflicts with Google GenAI SDK tool format
    // Only Google-provided tools (googleSearch, googleMaps) are supported

    await logToFile('🔧 TOOLS CONFIGURATION', {
      tools: tools.map(t => {
        if (typeof t === 'function') return `[Function: ${t.name}]`;
        return t;
      }),
      toolsCount: tools.length,
      hasToolConfig: !!toolConfig,
      toolConfig,
    });

    // Configure generation
    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    if (toolConfig) {
      config.toolConfig = toolConfig;
    }

    if (isReasoningEnabled) {
      config.thinkingConfig = {
        thinkingBudget: 8192,
        includeThoughts: true,
      };
    }

    await logToFile('⚙️ GENERATION CONFIG', {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      hasTools: !!config.tools,
      toolsCount: config.tools?.length,
      hasThinkingConfig: !!config.thinkingConfig,
    });

    // Force gemini-2.5-flash when RAG is active (no thinking mode)
    let effectiveModel = selectedChatModel;
    if (groundingType === 'rag-civil' || groundingType === 'rag-commerce') {
      effectiveModel = 'chat-model-medium'; // gemini-2.5-flash
      await logToFile('🔄 Forcing gemini-2.5-flash model for RAG', {
        originalModel: selectedChatModel,
        effectiveModel,
      });
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await logToFile('🚀 CREATING CHAT SESSION', {
            model: getModelName(effectiveModel as ChatModelId),
            historyLength: history.length,
          });

          // Create chat with history using the appropriate client
          const chat = activeClient.chats.create({
            model: getModelName(effectiveModel as ChatModelId),
            history: history,
            config: config,
          });

          const hasFiles = currentMessageParts.some((p: any) => p.inlineData);
          await logToFile('📤 SENDING MESSAGE', {
            hasFiles,
            partsCount: currentMessageParts.length,
            messagePreview: currentMessageText.substring(0, 100),
          });

          console.log('🚀 Sending to AI - hasFiles:', hasFiles, 'parts count:', currentMessageParts.length);

          // Send message and stream response
          // Use parts if there are files, otherwise use text
          const response = currentMessageParts.length > 1 || hasFiles
            ? await chat.sendMessageStream({
                message: currentMessageParts,
              })
            : await chat.sendMessageStream({
                message: currentMessageText,
              });

          console.log('✅ Message sent to AI, streaming response...');
          await logToFile('📡 STREAMING STARTED');

          let fullText = '';
          let fullThinkingText = '';
          const assistantMessageId = generateUUID();
          let chunkCount = 0;
          let hasToolCalls = false;

          // Stream the response
          for await (const chunk of response) {
            chunkCount++;

            // Log first few chunks to debug structure (non-blocking)
            if (chunkCount <= 5 && isReasoningEnabled) {
              const rawChunk = chunk as any;
              const parts = rawChunk.candidates?.[0]?.content?.parts || [];

              logToFile(`📦 Chunk #${chunkCount} (WITH THINKING CONFIG)`, {
                chunkKeys: Object.keys(chunk),
                hasText: !!chunk.text,
                textPreview: chunk.text?.substring(0, 100),
                hasFunctionCalls: !!chunk.functionCalls,
                // Detailed parts inspection
                hasCandidates: !!rawChunk.candidates,
                candidatesLength: rawChunk.candidates?.length,
                partsCount: parts.length,
                partsDetails: parts.map((p: any, idx: number) => ({
                  index: idx,
                  allKeys: Object.keys(p),
                  hasText: !!p.text,
                  textLength: p.text?.length,
                  textPreview: p.text?.substring(0, 100),
                  hasThought: !!p.thought,
                  thought: p.thought,
                  // Check other possible property names
                  hasThinking: !!p.thinking,
                  hasReasoning: !!p.reasoning,
                  hasReflection: !!p.reflection,
                })),
              }).catch(err => console.error('Log error:', err));
            }

            if (chunk.functionCalls) {
              hasToolCalls = true;
            }

            // Check for thinking in parts (according to Google docs)
            const rawChunk = chunk as any;
            if (rawChunk.candidates?.[0]?.content?.parts) {
              for (const part of rawChunk.candidates[0].content.parts) {
                // If this part is marked as a thought, stream it separately
                if (part.thought && part.text) {
                  fullThinkingText += part.text;

                  const thinkingData = {
                    type: 'thinking-delta',
                    thinkingDelta: part.text,
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingData)}\n\n`));
                }
              }
            }

            // Stream response text (non-thought text)
            if (chunk.text) {
              fullText += chunk.text;

              const data = {
                type: 'text-delta',
                textDelta: chunk.text,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            }
          }

          await logToFile('✅ STREAMING COMPLETE', {
            totalChunks: chunkCount,
            totalTextLength: fullText.length,
            hadToolCalls: hasToolCalls,
            textPreview: fullText.substring(0, 200),
          });

          // Save messages to database if user is authenticated
          if (user) {
            const dbMessages = [
              {
                id: message.id,
                chatId: id,
                role: 'user' as const,
                parts: message.parts,
                attachments: [], // Required field
                createdAt: new Date(),
              },
              {
                id: assistantMessageId,
                chatId: id,
                role: 'assistant' as const,
                parts: [{ type: 'text' as const, text: fullText }],
                attachments: [], // Required field
                createdAt: new Date(),
              },
            ];

            await saveMessages({ messages: dbMessages });

            // Update last context
            await updateChatLastContextById({
              chatId: id,
              context: { modelId: selectedChatModel } as any,
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
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Transfer-Encoding': 'chunked', // Force chunked transfer
      },
    });
  } catch (error: any) {
    console.error('Chat GenAI API error:', error);
    return new ChatSDKError('internal_server_error').toResponse();
  }
}
