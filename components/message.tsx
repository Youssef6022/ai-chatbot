'use client';
import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import { DocumentToolResult } from './document';
import { AnimatedSparklesIcon } from './icons';
import { Response } from './elements/response';
import { MessageContent } from './elements/message';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from './elements/tool';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { ChevronDownIcon } from './icons';

// Composant pour afficher un texte collé avec option de pliage/dépliage
function CollapsibleText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extraire le nom du fichier et le contenu
  const fileNameMatch = text.match(/--- Fichier: (.+?) ---/);
  const fileName = fileNameMatch ? fileNameMatch[1] : 'Texte collé';

  // Extraire le contenu entre les marqueurs
  const contentMatch = text.match(/--- Fichier: .+? ---\n([\s\S]*)\n--- Fin du fichier ---/);
  const content = contentMatch ? contentMatch[1] : text;

  // Tronquer à 300 caractères pour l'aperçu
  const preview = content.substring(0, 300);
  const shouldTruncate = content.length > 300;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 border-b border-white/20 pb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        <span className="text-xs font-semibold opacity-80">{fileName}</span>
      </div>

      <div className="whitespace-pre-wrap text-sm">
        {isExpanded ? content : preview}
        {!isExpanded && shouldTruncate && '...'}
      </div>

      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 self-start text-xs opacity-70 transition-opacity hover:opacity-100"
        >
          {isExpanded ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              Voir moins
            </>
          ) : (
            <>
              <ChevronDownIcon size={14} />
              Voir plus ({content.length} caractères)
            </>
          )}
        </button>
      )}
    </div>
  );
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  isArtifactVisible,
}: {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  isArtifactVisible: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  useDataStream();

  return (
    <motion.div
      data-testid={`message-${message.role}`}
      className="group/message w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn('flex w-full items-start gap-2 md:gap-3', {
          'justify-end': message.role === 'user' && mode !== 'edit',
          'justify-start': message.role === 'assistant',
        })}
      >
        {message.role === 'assistant' && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center">
            <AnimatedSparklesIcon
              size={16}
              animated={isLoading && !message.parts?.some(p => (p.type === 'text' && p.text) || (p.type === 'reasoning' && p.text))}
            />
          </div>
        )}

        <div
          className={cn('flex flex-col', {
            'gap-2 md:gap-4': message.parts?.some(
              (p) => p.type === 'text' && p.text?.trim(),
            ),
            'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            'w-full':
              (message.role === 'assistant' &&
                message.parts?.some(
                  (p) => p.type === 'text' && p.text?.trim(),
                )) ||
              mode === 'edit',
            'max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]':
              message.role === 'user' && mode !== 'edit',
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              data-testid={`message-attachments`}
              className="flex flex-row justify-end gap-2"
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={{
                    name: attachment.filename ?? 'file',
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === 'reasoning' && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  key={key}
                  isLoading={isLoading}
                  reasoning={part.text}
                />
              );
            }

            if (type === 'text') {
              if (mode === 'view') {
                // Détecter si c'est un texte collé avec marqueurs
                const isLongPastedText = part.text.includes('--- Fichier:') && part.text.includes('--- Fin du fichier ---');

                return (
                  <div key={key}>
                    <MessageContent
                      data-testid="message-content"
                      className={cn({
                        'w-fit break-words rounded-2xl px-3 py-2 text-left text-white':
                          message.role === 'user',
                        'bg-transparent px-0 py-0 text-left':
                          message.role === 'assistant',
                        'streaming-text': message.role === 'assistant' && isLoading,
                      })}
                      style={
                        message.role === 'user'
                          ? { backgroundColor: 'hsl(240 5.9% 18%)' }
                          : undefined
                      }
                    >
                      {isLongPastedText && message.role === 'user' ? (
                        <CollapsibleText text={sanitizeText(part.text)} />
                      ) : (
                        <Response isStreaming={isLoading}>{sanitizeText(part.text)}</Response>
                      )}
                    </MessageContent>
                  </div>
                );
              }

              if (mode === 'edit') {
                return (
                  <div
                    key={key}
                    className="flex w-full flex-row items-start gap-3"
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        regenerate={regenerate}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === 'tool-getWeather') {
              const { toolCallId, state } = part;

              return (
                <Tool key={toolCallId} defaultOpen={true}>
                  <ToolHeader type="tool-getWeather" state={state} />
                  <ToolContent>
                    {state === 'input-available' && (
                      <ToolInput input={part.input} />
                    )}
                    {state === 'output-available' && (
                      <ToolOutput
                        output={<Weather weatherAtLocation={part.output} />}
                        errorText={undefined}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === 'tool-createDocument') {
              const { toolCallId } = part;

              if (part.output && 'error' in part.output) {
                return (
                  <div
                    key={toolCallId}
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  key={toolCallId}
                  isReadonly={isReadonly}
                  result={part.output}
                />
              );
            }

            if (type === 'tool-updateDocument') {
              const { toolCallId } = part;

              if (part.output && 'error' in part.output) {
                return (
                  <div
                    key={toolCallId}
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div key={toolCallId} className="relative">
                  <DocumentPreview
                    isReadonly={isReadonly}
                    result={part.output}
                    args={{ ...part.output, isUpdate: true }}
                  />
                </div>
              );
            }

            if (type === 'tool-requestSuggestions') {
              const { toolCallId, state } = part;

              return (
                <Tool key={toolCallId} defaultOpen={true}>
                  <ToolHeader type="tool-requestSuggestions" state={state} />
                  <ToolContent>
                    {state === 'input-available' && (
                      <ToolInput input={part.input} />
                    )}
                    {state === 'output-available' && (
                      <ToolOutput
                        output={
                          'error' in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              type="request-suggestions"
                              result={part.output}
                              isReadonly={isReadonly}
                            />
                          )
                        }
                        errorText={undefined}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }
          })}

          {!isReadonly && message.role === 'assistant' && message.parts?.some(p => p.type === 'text' && p.text?.trim()) && (
            <MessageActions
              key={`action-${message.id}`}
              chatId={chatId}
              message={message}
              isLoading={isLoading}
              setMode={setMode}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

    return false;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="group/message w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-role={role}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center">
          <AnimatedSparklesIcon size={16} animated={true} />
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          {/* Empty space - icon shows thinking state */}
        </div>
      </div>
    </motion.div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
      style={{
        background:
          'linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
      className="flex items-center text-transparent"
    >
      {children}
    </motion.div>
  );
};
