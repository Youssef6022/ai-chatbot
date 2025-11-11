import type { Attachment } from '@/lib/types';
import { Loader } from './elements/loader';
import { CrossSmallIcon } from './icons';
import { Button } from './ui/button';
import Image from 'next/image';
import { useState, useEffect } from 'react';

// Helper function to get file extension and badge color
const getFileTypeInfo = (contentType: string, fileName: string) => {
  // Extract extension from filename
  const ext = fileName?.split('.').pop()?.toUpperCase() || 'FILE';

  if (contentType?.startsWith('image/')) {
    return {
      ext: ext || 'IMG',
      bgColor: 'bg-blue-500',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      )
    };
  }

  if (contentType === 'application/pdf') {
    return {
      ext: 'PDF',
      bgColor: 'bg-red-500',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      )
    };
  }

  if (contentType?.startsWith('text/') || contentType === 'text/plain') {
    return {
      ext: 'TXT',
      bgColor: 'bg-slate-500',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      )
    };
  }

  if (contentType?.startsWith('video/')) {
    return {
      ext: ext || 'VIDEO',
      bgColor: 'bg-purple-500',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      )
    };
  }

  if (contentType?.startsWith('audio/')) {
    return {
      ext: ext || 'AUDIO',
      bgColor: 'bg-green-500',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      )
    };
  }

  return {
    ext: ext.slice(0, 4),
    bgColor: 'bg-gray-500',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
    )
  };
};

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
  const fileInfo = getFileTypeInfo(contentType || '', name || '');

  // Load text preview for pasted text
  useEffect(() => {
    if (contentType === 'text/plain' && url.startsWith('blob:')) {
      fetch(url)
        .then(response => response.text())
        .then(text => {
          // Get first 150 characters for preview
          setTextPreview(text.substring(0, 150));
        })
        .catch(() => setTextPreview(''));
    }
  }, [url, contentType]);

  return (
    <div
      data-testid="input-attachment-preview"
      className="group relative flex h-20 w-20 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm transition-all hover:shadow-md"
    >
      {/* File type badge */}
      <div className={`absolute top-1 left-1 z-10 flex items-center gap-1 rounded px-1.5 py-0.5 text-white ${fileInfo.bgColor}`}>
        <div className="flex-shrink-0">
          {fileInfo.icon}
        </div>
        <span className="font-semibold text-[9px] leading-none">{fileInfo.ext}</span>
      </div>

      {/* Content preview */}
      <div className="relative flex size-full items-center justify-center overflow-hidden">
        {contentType?.startsWith('image') ? (
          <Image
            src={url}
            alt={name ?? 'An image attachment'}
            className="size-full object-cover"
            width={80}
            height={80}
          />
        ) : contentType === 'text/plain' ? (
          <div className="flex size-full flex-col items-start justify-start overflow-hidden bg-slate-50 p-2 dark:bg-slate-900">
            <div className='w-full overflow-hidden text-[8px] text-slate-600 leading-[1.3] dark:text-slate-400'>
              {textPreview}...
            </div>
          </div>
        ) : contentType === 'application/pdf' ? (
          <div className="flex size-full items-center justify-center bg-red-50 dark:bg-red-950/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-600 dark:text-red-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <text x="7" y="17" fontSize="6" fontWeight="bold" fill="currentColor">PDF</text>
            </svg>
          </div>
        ) : contentType === 'video/*' && (url.includes('youtube.com') || url.includes('youtu.be')) ? (
          <div className="flex size-full items-center justify-center bg-red-50 dark:bg-red-950/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#FF0000" className="drop-shadow-sm">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-muted/50 text-muted-foreground">
            {fileInfo.icon}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader size={20} />
        </div>
      )}

      {/* Remove button */}
      {onRemove && !isUploading && (
        <Button
          onClick={onRemove}
          size="sm"
          variant="destructive"
          className="absolute top-1 right-1 z-10 size-5 rounded-full p-0 opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        >
          <CrossSmallIcon size={10} />
        </Button>
      )}

      {/* File name */}
      <div className='absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 font-medium text-[9px] text-white'>
        {name}
      </div>
    </div>
  );
};
