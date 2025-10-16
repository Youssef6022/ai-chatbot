'use client';

import { useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';

interface NoteNodeData {
  label: string;
  content: string;
  onContentChange: (content: string) => void;
  onDelete?: () => void;
}

export function NoteNode({ data, selected }: NodeProps<NoteNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');

  const handleSave = useCallback(() => {
    data.onContentChange?.(content);
    setIsEditing(false);
  }, [content, data]);

  const handleCancel = useCallback(() => {
    setContent(data.content || '');
    setIsEditing(false);
  }, [data.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  return (
    <div className={`relative min-h-[120px] min-w-[200px] rounded-lg border-2 border-yellow-300 bg-yellow-200 p-3 shadow-lg dark:border-yellow-400 dark:bg-yellow-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Delete button */}
      {data.onDelete && (
        <button
          onClick={data.onDelete}
          className='absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600'
          title="Delete note"
        >
          ×
        </button>
      )}

      {/* Note content */}
      <div className="mt-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className='h-20 w-full resize-none rounded border border-yellow-400 bg-yellow-100 p-2 text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:border-yellow-500 dark:bg-yellow-200 dark:text-gray-900'
              placeholder="Tapez votre note..."
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                className='rounded bg-green-500 px-2 py-1 text-white text-xs hover:bg-green-600'
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                className='rounded bg-gray-500 px-2 py-1 text-white text-xs hover:bg-gray-600'
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className='min-h-[60px] cursor-text rounded p-2 text-gray-800 text-sm hover:bg-yellow-100 dark:text-gray-900 dark:hover:bg-yellow-200'
          >
            {data.content || 'Cliquez pour ajouter une note...'}
          </div>
        )}
      </div>

      {/* Helper text */}
      {!isEditing && (
        <div className='absolute right-2 bottom-1 text-xs text-yellow-700 opacity-60 dark:text-yellow-800'>
          📝
        </div>
      )}
    </div>
  );
}