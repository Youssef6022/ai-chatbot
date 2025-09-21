import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }

    if (!model || typeof model !== 'string') {
      return new Response('Invalid model', { status: 400 });
    }

    const result = await streamText({
      model: myProvider.languageModel(model),
      prompt: prompt,
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