'use server';

import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { genaiClient, getModelName } from '@/lib/ai/providers';
import type { ChatMessage } from '@/lib/types';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: ChatMessage;
}) {
  if (!genaiClient) {
    return 'New Chat';
  }

  try {
    const response = await genaiClient.models.generateContent({
      model: getModelName('title-model'),
      contents: `Generate a short title (max 80 characters) based on this message. Do not use quotes or colons. Just return the title text.

Message: ${JSON.stringify(message)}`,
    });

    return response.text?.trim() || 'New Chat';
  } catch (error) {
    console.error('Failed to generate title:', error);
    return 'New Chat';
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
