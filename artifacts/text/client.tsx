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
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
    {
      icon: <FileIcon size={18} />,
      description: 'Export to Google Docs',
      onClick: async ({ content }) => {
        try {
          // Convert markdown to HTML for rich formatting
          const htmlContent = content
            // Convert headers with proper Google Docs heading styles
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Convert bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Convert code to monospace
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Convert line breaks to paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

          // Wrap in paragraph tags
          const finalHtml = `<p>${htmlContent}</p>`;

          // Create both HTML and plain text for clipboard
          const plainText = content
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .trim();

          // Use the new clipboard API with both HTML and text
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([finalHtml], { type: 'text/html' }),
              'text/plain': new Blob([plainText], { type: 'text/plain' })
            })
          ]);

          // Open Google Docs blank document
          window.open('https://docs.google.com/document/create', '_blank');

          toast.success('Contenu avec formatage copié ! Collez-le dans Google Docs (Ctrl+V)');
        } catch (error) {
          // Fallback to plain text if HTML clipboard fails
          try {
            const plainText = content
              .replace(/^#{1,6}\s+/gm, '')
              .replace(/\*\*(.*?)\*\*/g, '$1')
              .replace(/\*(.*?)\*/g, '$1')
              .replace(/`(.*?)`/g, '$1')
              .trim();

            await navigator.clipboard.writeText(plainText);
            window.open('https://docs.google.com/document/create', '_blank');
            toast.success('Contenu copié ! Collez-le dans Google Docs (Ctrl+V)');
          } catch {
            window.open('https://docs.google.com/document/create', '_blank');
            toast.info('Google Docs ouvert. Copiez manuellement le contenu depuis l\'artefact.');
          }
        }
      },
    },
  ],
  toolbar: [],
});
