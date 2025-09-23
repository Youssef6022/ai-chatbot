import type { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, userPrompt, model } = await request.json();

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
      if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
        messages.push({ role: 'user', content: userPrompt });
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