'use client';

import { useState, useCallback, useRef, } from 'react';
import { flushSync } from 'react-dom';
import type { ChatMessage } from '@/lib/types';
import { generateUUID } from '@/lib/utils';

export type ChatStatus = 'ready' | 'submitting' | 'streaming';

export interface UseChatGenAIOptions {
  id: string;
  initialMessages: ChatMessage[];
  selectedModelId: string;
  selectedVisibilityType: 'public' | 'private';
  groundingType?: 'none' | 'search' | 'maps' | 'legal';
  isReasoningEnabled?: boolean;
  onFinish?: () => void;
  onError?: (error: Error) => void;
}

export interface UseChatGenAIResult {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendMessage: (message: Omit<ChatMessage, 'id'>) => Promise<void>;
  status: ChatStatus;
  stop: () => void;
  regenerate: () => Promise<void>;
}

export function useChatGenAI({
  id,
  initialMessages,
  selectedModelId,
  selectedVisibilityType,
  groundingType = 'none',
  isReasoningEnabled = false,
  onFinish,
  onError,
}: UseChatGenAIOptions): UseChatGenAIResult {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: Omit<ChatMessage, 'id'>) => {
      const newMessage: ChatMessage = {
        ...message,
        id: generateUUID(),
      };

      // Extract grounding and reasoning settings from message data
      const messageGroundingType = message.data?.groundingType || groundingType;
      const messageReasoningEnabled = message.data?.isReasoningEnabled ?? isReasoningEnabled;

      const assistantMessageId = generateUUID();

      // Add user message AND empty assistant message optimistically to show AI icon immediately
      setMessages((prev) => [
        ...prev,
        newMessage,
        {
          id: assistantMessageId,
          role: 'assistant' as const,
          parts: [],
        },
      ]);
      setStatus('streaming'); // Set to streaming immediately to show "Thinking..."

      try {
        abortControllerRef.current = new AbortController();

        const requestBody = {
          id,
          message: newMessage,
          selectedChatModel: selectedModelId,
          selectedVisibilityType,
          groundingType: messageGroundingType,
          isReasoningEnabled: messageReasoningEnabled,
        };

        const requestHeaders = {
          'Content-Type': 'application/json',
        };

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🌐 HTTP REQUEST TO API');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 URL:', `${window.location.origin}/api/chat`);
        console.log('📋 Method:', 'POST');
        console.log('📦 Headers:', requestHeaders);
        console.log('📄 Body:', JSON.stringify(requestBody, null, 2));
        console.log('🌍 groundingType in body:', requestBody.groundingType);
        console.log('🧠 isReasoningEnabled in body:', requestBody.isReasoningEnabled);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Status is already 'streaming' from earlier
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let accumulatedThinking = '';

        console.log('🔄 Starting SSE stream reader loop...');

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('📡 Stream ended (done=true)');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('📦 Raw chunk received:', chunk.length, 'bytes');
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (!data.trim()) continue;

              try {
                const parsed = JSON.parse(data);
                console.log('✅ Parsed SSE event:', parsed.type);

                if (parsed.type === 'thinking-delta') {
                  accumulatedThinking += parsed.thinkingDelta;

                  // Update assistant message with thinking text (use 'reasoning' type)
                  // Use flushSync to force immediate UI update
                  flushSync(() => {
                    setMessages((prev) => {
                      const lastMessage = prev[prev.length - 1];
                      if (lastMessage?.role === 'assistant' && lastMessage.id === assistantMessageId) {
                        // Update existing message
                        return [
                          ...prev.slice(0, -1),
                          {
                            ...lastMessage,
                            parts: [
                              { type: 'reasoning' as const, text: accumulatedThinking },
                              ...(accumulatedText ? [{ type: 'text' as const, text: accumulatedText }] : []),
                            ],
                          },
                        ];
                      } else {
                        // Create new assistant message with thinking
                        return [
                          ...prev,
                          {
                            id: assistantMessageId,
                            role: 'assistant' as const,
                            parts: [{ type: 'reasoning' as const, text: accumulatedThinking }],
                          },
                        ];
                      }
                    });
                  });
                } else if (parsed.type === 'text-delta') {
                  accumulatedText += parsed.textDelta;

                  // Update assistant message
                  // Use flushSync to force immediate UI update
                  flushSync(() => {
                    setMessages((prev) => {
                      const lastMessage = prev[prev.length - 1];
                      if (lastMessage?.role === 'assistant' && lastMessage.id === assistantMessageId) {
                        // Update existing message
                        const parts = accumulatedThinking
                          ? [
                              { type: 'reasoning' as const, text: accumulatedThinking },
                              { type: 'text' as const, text: accumulatedText },
                            ]
                          : [{ type: 'text' as const, text: accumulatedText }];

                        return [
                          ...prev.slice(0, -1),
                          {
                            ...lastMessage,
                            parts,
                          },
                        ];
                      } else {
                        // Create new assistant message
                        return [
                          ...prev,
                          {
                            id: assistantMessageId,
                            role: 'assistant' as const,
                            parts: [{ type: 'text' as const, text: accumulatedText }],
                          },
                        ];
                      }
                    });
                  });
                } else if (parsed.type === 'finish') {
                  setStatus('ready');
                  onFinish?.();
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        setStatus('ready');
      } catch (error: any) {
        console.error('Send message error:', error);
        setStatus('ready');

        if (error.name !== 'AbortError') {
          onError?.(error);
        }
      }
    },
    [id, selectedModelId, selectedVisibilityType, groundingType, isReasoningEnabled, onFinish, onError]
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('ready');
  }, []);

  const regenerate = useCallback(async () => {
    // Remove last assistant message and resend last user message
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
        newMessages.pop();
      }
      return newMessages;
    });

    // Find last user message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === 'user');

    if (lastUserMessage) {
      await sendMessage({
        role: lastUserMessage.role,
        parts: lastUserMessage.parts,
      });
    }
  }, [messages, sendMessage]);

  return {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  };
}
