'use client';

import { useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { StopIcon } from '@/components/icons';

interface StopNodeData {
  label: string;
  onDelete?: () => void;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

export function StopNode({ data, selected }: NodeProps<StopNodeData>) {

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    if (!data.connectingFrom) return '';

    const isHighlighted = data.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = data.connectingFrom && !isHighlighted;

    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  }, [data]);

  return (
    <>
      <div className='group relative flex flex-col items-center'>
        {/* Delete button (appears on hover) */}
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className='absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white opacity-0 shadow-md transition-opacity hover:bg-red-600 group-hover:opacity-100 dark:border-gray-800'
            title="Supprimer"
          >
            <span className='text-xs leading-none'>×</span>
          </button>
        )}

        {/* Circular Stop Node */}
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10 shadow-sm transition-all duration-300 hover:border-red-600 hover:bg-red-500/20 hover:shadow-md ${selected ? 'ring-2 ring-red-500' : ''}`}
        >
          <StopIcon size={24} className="text-red-600 dark:text-red-400" />

          {/* Input Handle */}
          <Handle
            type="target"
            position={Position.Top}
            id="input"
            className={getHandleClassName('input', 'target')}
            style={{
              top: '-8px',
              left: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#ef4444',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              transform: 'translateX(-50%)',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            }}
          />
        </div>

        {/* Label */}
        <div className='mt-2 max-w-[120px] truncate rounded bg-red-500/10 px-2 py-1 text-center text-red-700 text-xs font-medium dark:text-red-300'>
          {data.label}
        </div>
      </div>
    </>
  );
}
