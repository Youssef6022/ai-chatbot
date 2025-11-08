'use client';
import { memo, startTransition, useOptimistic, useState } from 'react';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import type { AuthSession } from '@/lib/auth/types';
import { Menu, PlusCircle, ChevronDown } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { CheckCircleFillIcon } from './icons';

// Compact model selector for mobile
function ModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] = useOptimistic(selectedModelId);

  const selectedModel = chatModels.find((m) => m.id === optimisticModelId);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-between px-3 text-sm font-medium"
        >
          <span className="truncate">{selectedModel?.name || 'Select model'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[280px]">
        {chatModels.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onSelect={() => {
              setOpen(false);
              startTransition(() => {
                setOptimisticModelId(model.id);
                saveChatModelAsCookie(model.id);
                onModelChange(model.id);
              });
            }}
            data-active={model.id === optimisticModelId}
            asChild
          >
            <button
              type="button"
              className="group/item flex w-full flex-row items-center justify-between gap-2"
            >
              <div className="flex flex-col items-start gap-1">
                <div className="text-sm">{model.name}</div>
                <div className="line-clamp-1 text-muted-foreground text-xs">
                  {model.description}
                </div>
              </div>
              <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                <CheckCircleFillIcon />
              </div>
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  session,
  selectedModelId,
  onModelChange,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session?: AuthSession;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}) {
  const { toggleSidebar } = useSidebar();
  const router = useRouter();

  return (
    <header className='sticky top-0 z-10 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2'>
      {/* Mobile topbar - visible only on mobile */}
      <div className="flex w-full items-center justify-between md:hidden">
        {/* Left: Menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => toggleSidebar()}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center: Model selector */}
        {selectedModelId && onModelChange && (
          <div className="flex-1 px-2">
            <ModelSelectorCompact
              selectedModelId={selectedModelId}
              onModelChange={onModelChange}
            />
          </div>
        )}

        {/* Right: New chat button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => {
            router.push('/');
            router.refresh();
          }}
        >
          <PlusCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop header - visible only on desktop */}
      <div className="hidden w-full items-center justify-end gap-2 md:flex">
        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.selectedModelId === nextProps.selectedModelId
  );
});