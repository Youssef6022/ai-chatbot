import type { NextRequest } from 'next/server';
import { genaiClient, getModelName, type ChatModelId } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, userPrompt, model, files, isSearchGroundingEnabled, isMapsGroundingEnabled } = await request.json();

    if (!model || typeof model !== 'string') {
      return new Response('Invalid model', { status: 400 });
    }

    if (!genaiClient) {
      return new Response('GenAI client not initialized', { status: 500 });
    }

    // Build message content
    let currentMessage = '';
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

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

        // If there are files, append their content
        if (files && Array.isArray(files) && files.length > 0) {
          for (const file of files) {
            if (file.url && file.contentType) {
              if (!file.contentType.startsWith('image/')) {
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

    // Configure generation
    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 1000,
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    if (toolConfig) {
      config.toolConfig = toolConfig;
    }

    // Create chat session
    const chat = genaiClient.chats.create({
      model: getModelName(model as ChatModelId),
      history: history,
      config: config,
    });

    // Send message and get response
    const response = await chat.sendMessage({
      message: currentMessage,
    });

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