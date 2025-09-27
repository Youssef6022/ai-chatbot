import type { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, userPrompt, model, files } = await request.json();

    if (!model || typeof model !== 'string') {
      return new Response('Invalid model', { status: 400 });
    }

    // Support both old format (prompt) and new format (systemPrompt + userPrompt)
    let messages = [];
    
    if (prompt && typeof prompt === 'string') {
      // Old format - single prompt
      messages = [{ role: 'user', content: prompt }];
    } else {
      // New format - system and user prompts
      if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      // Process user prompt and files
      if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
        let userContent: any = userPrompt;
        
        // If there are files, create multimodal content
        if (files && Array.isArray(files) && files.length > 0) {
          const contentParts = [{ type: 'text', text: userPrompt }];
          
          // Add each file to the content
          for (const file of files) {
            if (file.url && file.contentType) {
              if (file.contentType.startsWith('image/')) {
                // For images, add as image content
                contentParts.push({
                  type: 'image',
                  image: file.url
                });
              } else {
                // For other files, fetch content and add as text
                try {
                  const fileResponse = await fetch(file.url);
                  if (fileResponse.ok) {
                    const fileContent = await fileResponse.text();
                    contentParts.push({
                      type: 'text',
                      text: `\n\n--- Content of ${file.name} ---\n${fileContent}\n--- End of ${file.name} ---\n`
                    });
                  }
                } catch (error) {
                  console.error(`Error fetching file ${file.name}:`, error);
                  contentParts.push({
                    type: 'text',
                    text: `\n\n--- Error loading file ${file.name} ---\n`
                  });
                }
              }
            }
          }
          
          userContent = contentParts;
        }
        
        messages.push({ role: 'user', content: userContent });
      }
      
      // If no messages, return error
      if (messages.length === 0) {
        return new Response('At least one prompt (system or user) is required', { status: 400 });
      }
    }

    const result = await streamText({
      model: myProvider.languageModel(model),
      messages: messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Get the full text from the stream
    let fullText = '';
    for await (const textPart of result.textStream) {
      fullText += textPart;
    }

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