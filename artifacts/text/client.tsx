import { Artifact } from '@/components/create-artifact';
import { DiffView } from '@/components/diffview';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { Editor } from '@/components/text-editor';
import {
  ClockRewind,
  CopyIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  FileIcon,
  ChevronDownIcon,
} from '@/components/icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Useful for text content, like drafting essays and emails.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'data-suggestion') {
      setMetadata((metadata) => {
        return {
          suggestions: [...metadata.suggestions, streamPart.data],
        };
      });
    }

    if (streamPart.type === 'data-textDelta') {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + streamPart.data,
          isVisible:
            draftArtifact.status === 'streaming' &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          status: 'streaming',
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    return (
      <>
        {isCurrentVersion && (
          <div className='sticky top-0 z-10 flex items-center gap-2 border-b bg-background/80 px-4 py-2 text-muted-foreground text-xs backdrop-blur-sm'>
            <PenIcon size={12} />
            Édition directe activée - Cliquez dans le texte pour modifier
          </div>
        )}
        <div className="flex flex-row px-4 py-8 md:p-20">
          <Editor
            content={content}
            suggestions={metadata ? metadata.suggestions : []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
          />

          {metadata?.suggestions && metadata.suggestions.length > 0 ? (
            <div className="h-dvh w-12 shrink-0 md:hidden" />
          ) : null}
        </div>
      </>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex, setMetadata }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <div className="flex items-center gap-1"><CopyIcon size={16} /><ChevronDownIcon size={12} /></div>,
      description: 'Copy options',
      onClick: async ({ content }) => {
        // Find the button element to position the dropdown
        const buttonElement = document.activeElement as HTMLElement;
        const rect = buttonElement?.getBoundingClientRect();
        
        // Calculate position to avoid going off screen
        const dropdownWidth = 160;
        const dropdownHeight = 80; // Approximate height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = rect?.left || 0;
        let top = (rect?.bottom || 0) + 5;
        
        // Adjust if dropdown would go off right edge
        if (left + dropdownWidth > viewportWidth) {
          left = viewportWidth - dropdownWidth - 10;
        }
        
        // Adjust if dropdown would go off bottom edge
        if (top + dropdownHeight > viewportHeight) {
          top = (rect?.top || 0) - dropdownHeight - 5;
        }
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.style.cssText = `
          position: fixed;
          top: ${top}px;
          left: ${left}px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 10000;
          min-width: ${dropdownWidth}px;
          overflow: hidden;
        `;
        
        dropdown.innerHTML = `
          <button id="copy-clipboard" style="
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: white;
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
            border-bottom: 1px solid #f3f4f6;
          " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
            Copy to clipboard
          </button>
          <button id="copy-googledocs" style="
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: white;
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
          " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
            Copy for Google Docs
          </button>
        `;

        document.body.appendChild(dropdown);

        // Handle clicks outside to close
        const handleOutsideClick = (e: MouseEvent) => {
          if (!dropdown.contains(e.target as Node)) {
            document.body.removeChild(dropdown);
            document.removeEventListener('click', handleOutsideClick);
          }
        };

        setTimeout(() => {
          document.addEventListener('click', handleOutsideClick);
        }, 100);

        // Handle button clicks
        dropdown.querySelector('#copy-clipboard')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(content);
            toast.success('Copied to clipboard!');
          } catch {
            toast.error('Failed to copy');
          }
          document.body.removeChild(dropdown);
          document.removeEventListener('click', handleOutsideClick);
        });

        dropdown.querySelector('#copy-googledocs')?.addEventListener('click', async () => {
          try {
            // Convert markdown to HTML for rich formatting
            const htmlContent = content
              .replace(/^### (.*$)/gm, '<h3>$1</h3>')
              .replace(/^## (.*$)/gm, '<h2>$1</h2>')
              .replace(/^# (.*$)/gm, '<h1>$1</h1>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/_(.*?)_/g, '<em>$1</em>')
              .replace(/`(.*?)`/g, '<code>$1</code>')
              .replace(/\n\n/g, '</p><p>')
              .replace(/\n/g, '<br>');

            const finalHtml = `<p>${htmlContent}</p>`;

            // Copy with HTML formatting
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': new Blob([finalHtml], { type: 'text/html' }),
                'text/plain': new Blob([content], { type: 'text/plain' })
              })
            ]);

            toast.success('Ready to paste in Google Docs');
          } catch {
            toast.error('Failed to copy formatted content');
          }
          document.body.removeChild(dropdown);
          document.removeEventListener('click', handleOutsideClick);
        });
      },
    },
  ],
  toolbar: [],
});
