'use client';

import { useState, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';

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
    <div className={`relative bg-yellow-200 dark:bg-yellow-300 border-2 border-yellow-300 dark:border-yellow-400 rounded-lg shadow-lg min-w-[200px] min-h-[120px] p-3 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Delete button */}
      {data.onDelete && (
        <button
          onClick={data.onDelete}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 flex items-center justify-center"
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
              className="w-full h-20 p-2 text-sm bg-yellow-100 dark:bg-yellow-200 border border-yellow-400 dark:border-yellow-500 rounded resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500 text-gray-800 dark:text-gray-900"
              placeholder="Tapez votre note..."
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="min-h-[60px] p-2 text-sm cursor-text hover:bg-yellow-100 dark:hover:bg-yellow-200 rounded text-gray-800 dark:text-gray-900"
          >
            {data.content || 'Cliquez pour ajouter une note...'}
          </div>
        )}
      </div>

      {/* Helper text */}
      {!isEditing && (
        <div className="absolute bottom-1 right-2 text-xs text-yellow-700 dark:text-yellow-800 opacity-60">
          📝
        </div>
      )}
    </div>
  );
}