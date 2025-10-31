'use client';

import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
  useMemo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import {
  ArrowUpIcon,
  PaperclipIcon,
  CpuIcon,
  StopIcon,
  ChevronDownIcon,
} from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from './elements/prompt-input';
import { SelectItem } from '@/components/ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import equal from 'fast-deep-equal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';
import type { AppUsage } from '@/lib/usage';
import { chatModels } from '@/lib/ai/models';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { startTransition } from 'react';
import { Context } from './elements/context';
import { FileSelectionModal } from './library/file-selection-modal';
import { useQuota } from '@/lib/hooks/use-quota';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { quota, updateQuota } = useQuota();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');

    // Limite maximale: 100 000 caractères (~25 000 tokens) - correspond à la limite de l'API
    const MAX_PASTE_LENGTH = 100000;

    if (pastedText && pastedText.length > MAX_PASTE_LENGTH) {
      event.preventDefault();
      toast.error(`Le texte collé est trop long (${pastedText.length.toLocaleString()} caractères). Maximum: ${MAX_PASTE_LENGTH.toLocaleString()} caractères.`);
      return;
    }

    // Si le texte collé est long (> 200 caractères), créer une pièce jointe
    if (pastedText && pastedText.length > 200) {
      event.preventDefault(); // Empêcher le collage normal

      // Créer une "pièce jointe" pour le texte collé
      const textBlob = new Blob([pastedText], { type: 'text/plain' });
      const textUrl = URL.createObjectURL(textBlob);

      const pastedAttachment: Attachment & { textContent?: string } = {
        url: textUrl,
        name: `Pasted (${pastedText.length.toLocaleString()} chars)`,
        contentType: 'text/plain',
        textContent: pastedText, // Stocker le contenu directement
      };

      setAttachments((current) => [...current, pastedAttachment as Attachment]);
      toast.success(`Texte collé ajouté (${pastedText.length.toLocaleString()} caractères)`);
    }
    // Si le texte est court, laisser le comportement par défaut
  }, [setAttachments]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [groundingType, setGroundingType] = useLocalStorage<'none' | 'search' | 'maps' | 'rag-civil' | 'rag-commerce' | 'rag-droit-francais'>(
    'grounding-type',
    'none',
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Enable reasoning automatically for medium and large models, but disable when RAG is active
  const isReasoningEnabled = (selectedModelId.includes('medium') || selectedModelId.includes('large'))
    && !groundingType.startsWith('rag-');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const submitForm = useCallback(async () => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    console.log('🚀 submitForm called with:', { groundingType, isReasoningEnabled });

    // Déterminer la taille du modèle à partir de l'ID
    let modelSize: 'small' | 'medium' | 'large' = 'small';
    if (selectedModelId.includes('medium')) {
      modelSize = 'medium';
    } else if (selectedModelId.includes('large')) {
      modelSize = 'large';
    }

    try {
      // Mettre à jour le quota avant d'envoyer le message
      await updateQuota(modelSize);
    } catch (error) {
      console.error('Quota update failed:', error);
      toast.error('Quota exceeded. Please upgrade your plan.');
      return;
    }

    const messageData = {
      groundingType,
      isReasoningEnabled,
    };

    console.log('📤 Sending message with data:', messageData);

    // Construire les parts du message
    const messageParts = [];
    let combinedText = '';

    // Ajouter les fichiers et textes collés
    for (const attachment of attachments) {
      if ((attachment as any).textContent) {
        // Texte collé - ajouter au texte combiné
        combinedText += `--- Pasted Content ---\n${(attachment as any).textContent}\n--- End of Pasted Content ---\n\n`;
      } else {
        // Fichier normal (image, etc.)
        messageParts.push({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        });
      }
    }

    // Ajouter le texte de saisie au texte combiné
    combinedText += input;

    // Ajouter le texte combiné comme une seule partie
    if (combinedText.trim()) {
      messageParts.push({
        type: 'text',
        text: combinedText,
      });
    }

    sendMessage({
      role: 'user',
      parts: messageParts,
      data: messageData,
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    selectedModelId,
    updateQuota,
    groundingType,
    isReasoningEnabled,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  // Note: modelResolver not needed with GenAI SDK
  // const modelResolver = useMemo(() => {
  //   return myProvider.languageModel(selectedModelId);
  // }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
      userQuota: quota,
      selectedModelId,
    }),
    [usage, quota, selectedModelId],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const handleLibraryFilesSelected = useCallback(
    (libraryFiles: Array<{ url: string; name: string; contentType: string }>) => {
      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...libraryFiles,
      ]);
    },
    [setAttachments],
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the main container
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Déterminer la couleur du contour selon le grounding type actif
  const borderColor = isHydrated && groundingType === 'search'
    ? 'border-blue-500/50 focus-within:border-blue-500'
    : isHydrated && groundingType === 'maps'
    ? 'border-green-500/50 focus-within:border-green-500'
    : 'border-border focus-within:border-border';

  // Drag and drop styles
  const dragDropStyles = isDragging
    ? 'border-blue-500 border-2 bg-blue-50/50 dark:bg-blue-950/20'
    : '';

  return (
    <div className='relative flex w-full flex-col gap-4'>
      <input
        type="file"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className='relative'
      >
        <PromptInput
          className={`rounded-xl border bg-background p-3 shadow-xs transition-all duration-200 hover:border-muted-foreground/50 ${borderColor} ${dragDropStyles}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (status !== 'ready') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }}
        >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            data-testid="attachments-preview"
            className='flex flex-row items-end gap-2 overflow-x-scroll'
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url),
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}
        <div className='flex flex-row items-start gap-1 sm:gap-2'>
          <PromptInputTextarea
            data-testid="multimodal-input"
            ref={textareaRef}
            placeholder="Send a message..."
            value={input}
            onChange={handleInput}
            onPaste={handlePaste}
            minHeight={44}
            maxHeight={200}
            disableAutoResize={true}
            className='grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden'
            rows={1}
            autoFocus
          />{' '}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              status={status}
              selectedModelId={selectedModelId}
              onFileModalOpen={() => setIsFileModalOpen(true)}
            />
            <GoogleSearchButton
              isEnabled={groundingType === 'search'}
              onToggle={(enabled) => setGroundingType(enabled ? 'search' : 'none')}
              status={status}
              isHydrated={isHydrated}
            />
            <GoogleMapsButton
              isEnabled={groundingType === 'maps'}
              onToggle={(enabled) => setGroundingType(enabled ? 'maps' : 'none')}
              status={status}
              isHydrated={isHydrated}
            />
            <RAGButton
              currentType={groundingType}
              onSelect={(type) => setGroundingType(type)}
              status={status}
              isHydrated={isHydrated}
            />
          </PromptInputTools>

          <div className="flex items-center gap-1">
            <ModelSelectorCompact selectedModelId={selectedModelId} onModelChange={onModelChange} />

            {status === 'submitted' ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || uploadQueue.length > 0}
                className='size-8 rounded-full bg-blue-primary text-blue-primary-foreground transition-colors duration-200 hover:bg-blue-primary/90 disabled:bg-muted disabled:text-muted-foreground'
                style={{
                  backgroundColor: !input.trim() || uploadQueue.length > 0 ? undefined : 'var(--blue-primary)',
                  color: !input.trim() || uploadQueue.length > 0 ? undefined : 'var(--blue-primary-foreground)'
                }}
              >
                <ArrowUpIcon size={14} />
              </PromptInputSubmit>
            )}
          </div>
        </PromptInputToolbar>
      </PromptInput>

      {/* Drag and drop overlay indicator */}
      {isDragging && (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-blue-500 border-dashed bg-blue-50/80 dark:bg-blue-950/40'>
          <div className='flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400'>
            <PaperclipIcon size={32} />
            <p className='font-medium text-sm'>Déposez vos fichiers ici</p>
          </div>
        </div>
      )}
      </div>

      <FileSelectionModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        onFilesSelected={handleLibraryFilesSelected}
        fileInputRef={fileInputRef}
      />
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
  onFileModalOpen,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
  selectedModelId: string;
  onFileModalOpen: () => void;
}) {
  const isReasoningModel = false; // Tous les modèles supportent maintenant les attachements

  return (
    <Button
      data-testid="attachments-button"
      className='aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent'
      onClick={(event) => {
        event.preventDefault();
        onFileModalOpen();
      }}
      disabled={status !== 'ready' || isReasoningModel}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId,
  );

  return (
    <PromptInputModelSelect
      value={selectedModel?.name}
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
    >
      <SelectPrimitive.Trigger
        type="button"
        className='flex h-8 items-center gap-2 rounded-lg border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0'
      >
        <CpuIcon size={16} />
        <span className='hidden font-medium text-xs sm:block'>
          {selectedModel?.name}
        </span>
        <ChevronDownIcon size={16} />
      </SelectPrimitive.Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem
              key={model.id}
              value={model.name}
              className="px-3 py-2 text-xs"
            >
              <div className='flex min-w-0 flex-1 flex-col gap-1'>
                <div className='truncate font-medium text-xs'>{model.name}</div>
                <div className='truncate text-[10px] text-muted-foreground leading-tight'>
                  {model.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className='size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground'
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureGoogleSearchButton({
  isEnabled,
  onToggle,
  status,
  isHydrated,
}: {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  status: UseChatHelpers<ChatMessage>['status'];
  isHydrated: boolean;
}) {
  const title = isHydrated
    ? isEnabled ? 'Désactiver la recherche avec Google' : 'Activer la recherche avec Google'
    : 'Recherche avec Google';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="google-search-button"
            className="aspect-square h-8 w-8 rounded-lg p-1.5 transition-all hover:bg-accent"
            onClick={(event) => {
              event.preventDefault();
              console.log('🔍 Google Search clicked! Current:', isEnabled, '→ New:', !isEnabled);
              onToggle(!isEnabled);
            }}
            disabled={status !== 'ready'}
            variant="ghost"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-3 0 262 262"
              className="h-full w-full"
              style={{
                filter: isEnabled && isHydrated ? 'none' : 'grayscale(100%)',
                opacity: isEnabled && isHydrated ? 1 : 0.5,
                transition: 'filter 0.2s ease, opacity 0.2s ease'
              }}
            >
              <path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/>
              <path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/>
              <path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/>
              <path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/>
            </svg>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover text-popover-foreground">
          <p className="text-xs">{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const GoogleSearchButton = memo(PureGoogleSearchButton);

function PureGoogleMapsButton({
  isEnabled,
  onToggle,
  status,
  isHydrated,
}: {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  status: UseChatHelpers<ChatMessage>['status'];
  isHydrated: boolean;
}) {
  const title = isHydrated
    ? isEnabled ? 'Désactiver la recherche avec Google Maps' : 'Activer la recherche avec Google Maps'
    : 'Recherche avec Google Maps';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="google-maps-button"
            className="aspect-square h-8 w-8 rounded-lg p-1.5 transition-all hover:bg-accent"
            onClick={(event) => {
              event.preventDefault();
              console.log('📍 Google Maps clicked! Current:', isEnabled, '→ New:', !isEnabled);
              onToggle(!isEnabled);
            }}
            disabled={status !== 'ready'}
            variant="ghost"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-55.5 0 367 367"
              className="h-full w-full"
              style={{
                filter: isEnabled && isHydrated ? 'none' : 'grayscale(100%)',
                opacity: isEnabled && isHydrated ? 1 : 0.5,
                transition: 'filter 0.2s ease, opacity 0.2s ease'
              }}
            >
              <path fill="#34a853" d="M70.585 271.865a371 371 0 0 1 28.911 42.642c7.374 13.982 10.448 23.463 15.837 40.31c3.305 9.308 6.292 12.086 12.714 12.086c6.998 0 10.173-4.726 12.626-12.035c5.094-15.91 9.091-28.052 15.397-39.525c12.374-22.15 27.75-41.833 42.858-60.75c4.09-5.354 30.534-36.545 42.439-61.156c0 0 14.632-27.035 14.632-64.792c0-35.318-14.43-59.813-14.43-59.813l-41.545 11.126l-25.23 66.451l-6.242 9.163l-1.248 1.66l-1.66 2.078l-2.914 3.319l-4.164 4.163l-22.467 18.304l-56.17 32.432z"/>
              <path fill="#fbbc04" d="M12.612 188.892c13.709 31.313 40.145 58.839 58.031 82.995l95.001-112.534s-13.384 17.504-37.662 17.504c-27.043 0-48.89-21.595-48.89-48.825c0-18.673 11.234-31.501 11.234-31.501l-64.489 17.28z"/>
              <path fill="#4285f4" d="M166.705 5.787c31.552 10.173 58.558 31.53 74.893 63.023l-75.925 90.478s11.234-13.06 11.234-31.617c0-27.864-23.463-48.68-48.81-48.68c-23.969 0-37.735 17.475-37.735 17.475v-57z"/>
              <path fill="#1a73e8" d="M30.015 45.765C48.86 23.218 82.02 0 127.736 0c22.18 0 38.89 5.823 38.89 5.823L90.29 96.516H36.205z"/>
              <path fill="#ea4335" d="M12.612 188.892S0 164.194 0 128.414c0-33.817 13.146-63.377 30.015-82.649l60.318 50.759z"/>
            </svg>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover text-popover-foreground">
          <p className="text-xs">{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const GoogleMapsButton = memo(PureGoogleMapsButton);

function PureRAGButton({
  currentType,
  onSelect,
  status,
  isHydrated,
}: {
  currentType: 'none' | 'search' | 'maps' | 'rag-civil' | 'rag-commerce' | 'rag-droit-francais';
  onSelect: (type: 'rag-civil' | 'rag-commerce' | 'rag-droit-francais') => void;
  status: UseChatHelpers<ChatMessage>['status'];
  isHydrated: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const isRagActive = currentType === 'rag-civil' || currentType === 'rag-commerce' || currentType === 'rag-droit-francais';

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top - 8, // 8px margin above the button
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const getTitle = () => {
    if (!isHydrated) return 'Recherche RAG';
    if (currentType === 'rag-civil') return 'RAG: Code Civil';
    if (currentType === 'rag-commerce') return 'RAG: Code Commerce';
    if (currentType === 'rag-droit-francais') return 'RAG: Codes Droit FR';
    return 'Activer la recherche RAG';
  };

  const handleSelect = (type: 'rag-civil' | 'rag-commerce' | 'rag-droit-francais') => {
    console.log('📚 RAG clicked! Current:', currentType, '→ New:', type);
    onSelect(type);
    setIsOpen(false);
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={buttonRef}
              data-testid="rag-button"
              className="aspect-square h-8 w-8 rounded-lg p-1.5 transition-all hover:bg-accent"
              onClick={(event) => {
                event.preventDefault();
                if (isRagActive) {
                  // If RAG is active, toggle the dropdown
                  setIsOpen(!isOpen);
                } else {
                  // If RAG is not active, activate Code Civil by default
                  handleSelect('rag-civil');
                }
              }}
              disabled={status !== 'ready'}
              variant="ghost"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-full w-full"
                style={{
                  color: isRagActive && isHydrated ? '#8b5cf6' : 'currentColor',
                  opacity: isRagActive && isHydrated ? 1 : 0.5,
                  transition: 'color 0.2s ease, opacity 0.2s ease'
                }}
              >
                {/* Book icon */}
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-popover text-popover-foreground">
            <p className="text-xs">{getTitle()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown menu - rendered as fixed positioned element */}
      {isOpen && isRagActive && (
        <div
          ref={dropdownRef}
          className='fixed z-[9999] w-48 rounded-lg border bg-popover p-1 shadow-xl'
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
              currentType === 'rag-civil' ? 'bg-accent font-medium' : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('rag-civil');
            }}
          >
            📖 Code Civil
          </button>
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
              currentType === 'rag-commerce' ? 'bg-accent font-medium' : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('rag-commerce');
            }}
          >
            💼 Code Commerce
          </button>
          <button
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
              currentType === 'rag-droit-francais' ? 'bg-accent font-medium' : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('rag-droit-francais');
            }}
          >
            ⚖️ Codes Droit Français
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            className='w-full rounded-md px-3 py-2 text-left text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground'
            onClick={(e) => {
              e.preventDefault();
              onSelect('none' as any);
              setIsOpen(false);
            }}
          >
            ❌ Désactiver RAG
          </button>
        </div>
      )}
    </>
  );
}

const RAGButton = memo(PureRAGButton);
