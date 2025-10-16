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
      className={`relative w-64 h-40 rounded-lg border-2 border-yellow-300 bg-yellow-50 shadow-lg transition-all duration-200 dark:border-yellow-400 dark:bg-yellow-100 ${selected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={handleClick}
    >
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
          className='h-full w-full resize-none border-none bg-transparent text-gray-800 text-sm placeholder:text-yellow-600 focus:outline-none dark:text-gray-900 dark:placeholder:text-yellow-700 overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-400 scrollbar-track-yellow-100'
          placeholder="Tapez votre note..."
        />
      </div>
    </div>
  );
}