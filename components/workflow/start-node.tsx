'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PlayIcon } from '@/components/icons';

interface StartNodeData {
  label: string;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

export function StartNode({ data, selected }: NodeProps<StartNodeData>) {

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = (handleId: string, handleType: 'source' | 'target') => {
    if (!data.connectingFrom) return '';

    const isHighlighted = data.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = data.connectingFrom && !isHighlighted;

    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  };

  return (
    <div className='group relative flex flex-col items-center'>
      {/* Circular Start Node - Non-deletable */}
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/10 shadow-sm transition-all duration-300 hover:border-green-600 hover:bg-green-500/20 hover:shadow-md ${selected ? 'ring-2 ring-green-500' : ''}`}
      >
        <PlayIcon size={24} className="text-green-600 dark:text-green-400" />

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          className={getHandleClassName('output', 'source')}
          style={{
            bottom: '-8px',
            left: '50%',
            width: '16px',
            height: '16px',
            backgroundColor: '#22c55e',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
          }}
        />
      </div>

      {/* Label */}
      <div className='mt-2 max-w-[120px] truncate rounded bg-green-500/10 px-2 py-1 text-center text-green-700 text-xs font-medium dark:text-green-300'>
        {data.label}
      </div>
    </div>
  );
}
