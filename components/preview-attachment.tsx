import type { Attachment } from '@/lib/types';
import { Loader } from './elements/loader';
import { CrossSmallIcon } from './icons';
import { Button } from './ui/button';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
  onEdit,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const [textPreview, setTextPreview] = useState<string>('');

  // Load text preview for pasted text
  useEffect(() => {
    if (contentType === 'text/plain' && url.startsWith('blob:')) {
      fetch(url)
        .then(response => response.text())
        .then(text => {
          // Get first 100 characters for preview
          setTextPreview(text.substring(0, 100));
        })
        .catch(() => setTextPreview(''));
    }
  }, [url, contentType]);

  return (
    <div
      data-testid="input-attachment-preview"
      className="group relative size-16 overflow-hidden rounded-lg border bg-muted"
    >
      {contentType?.startsWith('image') ? (
        <Image
          src={url}
          alt={name ?? 'An image attachment'}
          className="size-full object-cover"
          width={64}
          height={64}
        />
      ) : contentType === 'text/plain' ? (
        <div className="flex size-full flex-col items-start justify-start overflow-hidden bg-slate-100 p-1.5 dark:bg-slate-800">
          <div className="mb-0.5 flex w-full items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className='flex-shrink-0 text-slate-600 dark:text-slate-400'>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            <span className='truncate font-medium text-[8px] text-slate-700 dark:text-slate-300'>TXT</span>
          </div>
          <div className='w-full overflow-hidden text-[7px] text-slate-600 leading-tight dark:text-slate-400'>
            {textPreview}...
          </div>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
          File
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader size={16} />
        </div>
      )}

      {onRemove && !isUploading && (
        <Button
          onClick={onRemove}
          size="sm"
          variant="destructive"
          className="absolute top-0.5 right-0.5 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <CrossSmallIcon size={8} />
        </Button>
      )}

      <div className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/80 to-transparent px-1 py-0.5 text-[10px] text-white">
        {name}
      </div>
    </div>
  );
};
