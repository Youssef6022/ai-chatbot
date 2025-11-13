'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';

interface NoteNodeData {
  label: string;
  content: string;
  onContentChange: (content: string) => void;
  onDelete?: () => void;
}

export function NoteNode({ data, selected }: NodeProps<NoteNodeData>) {
  const [content, setContent] = useState(data.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save content when it changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (content !== data.content) {
        data.onContentChange?.(content);
      }
    }, 500); // Auto-save after 500ms of inactivity

    return () => clearTimeout(timeoutId);
  }, [content, data]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent node selection when clicking on the note content
    e.stopPropagation();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div
      className={`group relative h-40 w-64 rounded-lg border-2 border-yellow-300 bg-yellow-50 shadow-lg transition-all duration-200 dark:border-yellow-400 dark:bg-yellow-100 ${selected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={handleClick}
    >
      {/* Delete button - only show when selected or on hover */}
      {data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
          className={`absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white transition-opacity hover:bg-red-600 ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="Supprimer la note"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}

      {/* Content area */}
      <div
        className="h-full p-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className='scrollbar-thin scrollbar-thumb-yellow-400 scrollbar-track-yellow-100 h-full w-full resize-none overflow-y-auto border-none bg-transparent text-gray-800 text-sm placeholder:text-yellow-600 focus:outline-none dark:text-gray-900 dark:placeholder:text-yellow-700'
          placeholder="Tapez votre note..."
        />
      </div>
    </div>
  );
}