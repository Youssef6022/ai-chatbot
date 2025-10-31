import type { NextRequest } from 'next/server';
import { genaiClient, vertexAIClient, getModelName, type ChatModelId } from '@/lib/ai/providers';
import { getSystemPrompt } from '@/lib/ai/system-prompts';

export const maxDuration = 120; // Increased to 120s for RAG queries

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, userPrompt, model, files, isSearchGroundingEnabled, isMapsGroundingEnabled, ragCorpus } = await request.json();

    if (!model || typeof model !== 'string') {
      return new Response('Invalid model', { status: 400 });
    }

    // Determine which client to use based on RAG corpus selection
    const isRAG = ragCorpus && ragCorpus !== 'none';
    const activeClient = isRAG ? vertexAIClient : genaiClient;

    if (!activeClient) {
      return new Response('GenAI client not initialized', { status: 500 });
    }

    // Build message content - support both text and files (images)
    let currentMessage = '';
    const messageParts: Array<any> = [];
    const history: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];

    if (prompt && typeof prompt === 'string') {
      // Old format - single prompt
      currentMessage = prompt;
    } else {
      // New format - system and user prompts combined
      if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
        currentMessage += `${systemPrompt}\n\n`;
      }

      // Process user prompt and files
      if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
        currentMessage += userPrompt;

        // If there are files, process them for multimodal input
        if (files && Array.isArray(files) && files.length > 0) {
          console.log('📨 Processing files for workflow:', files.length);

          for (const file of files) {
            if (file.url && file.contentType) {
              if (file.contentType.startsWith('image/')) {
                // For images, fetch and convert to base64 for AI vision
                console.log('🖼️ Processing image:', file.url);
                try {
                  const fileResponse = await fetch(file.url);
                  console.log('✅ Image fetch status:', fileResponse.status);

                  if (fileResponse.ok) {
                    const arrayBuffer = await fileResponse.arrayBuffer();
                    console.log('📦 ArrayBuffer size:', arrayBuffer.byteLength);

                    const base64Data = Buffer.from(arrayBuffer).toString('base64');
                    console.log('🔐 Base64 data length:', base64Data.length);

                    messageParts.push({
                      inlineData: {
                        mimeType: file.contentType,
                        data: base64Data,
                      },
                    });
                    console.log('✅ Image part added successfully');
                  }
                } catch (error) {
                  console.error(`❌ Error fetching image ${file.name}:`, error);
                }
              } else {
                // For text files, fetch content and add as text
                try {
                  const fileResponse = await fetch(file.url);
                  if (fileResponse.ok) {
                    const fileContent = await fileResponse.text();
                    currentMessage += `\n\n--- Content of ${file.name} ---\n${fileContent}\n--- End of ${file.name} ---\n`;
                  }
                } catch (error) {
                  console.error(`Error fetching file ${file.name}:`, error);
                  currentMessage += `\n\n--- Error loading file ${file.name} ---\n`;
                }
              }
            }
          }
        }
      }

      // If no message content, return error
      if (!currentMessage.trim()) {
        return new Response('At least one prompt (system or user) is required', { status: 400 });
      }
    }

    // Prepare tools configuration
    const tools: any[] = [];
    let toolConfig: any = undefined;

    // Add Google Search tool if search grounding is enabled
    if (isSearchGroundingEnabled) {
      tools.push({ googleSearch: {} });
    }

    // Add Google Maps tool if maps grounding is enabled
    if (isMapsGroundingEnabled) {
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
    }

    // Add RAG tool if RAG corpus is selected
    if (isRAG) {
      let ragCorpusId: string;

      if (ragCorpus === 'rag-civil') {
        ragCorpusId = 'projects/total-apparatus-451215-g1/locations/europe-west3/ragCorpora/3379951520341557248';
      } else if (ragCorpus === 'rag-commerce') {
        ragCorpusId = 'projects/total-apparatus-451215-g1/locations/europe-west3/ragCorpora/2842897264777625600';
      } else if (ragCorpus === 'rag-droit-francais') {
        ragCorpusId = 'projects/968778883206/locations/europe-west1/ragCorpora/2305843009213693952';
      } else {
        ragCorpusId = '';
      }

      if (ragCorpusId) {
        tools.push({
          retrieval: {
            vertex_rag_store: {
              rag_resources: [{
                rag_corpus: ragCorpusId,
              }],
              similarity_top_k: 20,
            },
          },
        });
      }
    }

    // Determine grounding type for system instruction
    let groundingType = 'none';
    if (isSearchGroundingEnabled) {
      groundingType = 'search';
    } else if (isMapsGroundingEnabled) {
      groundingType = 'maps';
    } else if (isRAG) {
      groundingType = ragCorpus;
    }

    // Get system instruction based on grounding type
    const systemInstruction = getSystemPrompt(groundingType);

    // Configure generation
    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 1000,
      systemInstruction: systemInstruction,
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    if (toolConfig) {
      config.toolConfig = toolConfig;
    }

    // Create chat session using the appropriate client (Vertex AI for RAG, GenAI for others)
    const chat = activeClient.chats.create({
      model: getModelName(model as ChatModelId),
      history: history,
      config: config,
    });

    // Prepare message - use parts if there are images, otherwise use text
    const hasImages = messageParts.length > 0;
    console.log('🚀 Sending to AI - hasImages:', hasImages, 'parts count:', messageParts.length);

    let finalMessage: any;
    if (hasImages) {
      // Add text part to the beginning
      finalMessage = [
        { text: currentMessage },
        ...messageParts,
      ];
    } else {
      // Simple text message
      finalMessage = currentMessage;
    }

    // Send message and get response
    const response = await chat.sendMessage({
      message: finalMessage,
    });

    console.log('✅ Message sent to AI, got response');

    // Extract text from response
    const fullText = response.text || '';

    return new Response(fullText, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('Error in workflow generate:', error);
    return new Response('Internal server error', { status: 500 });
  }
}