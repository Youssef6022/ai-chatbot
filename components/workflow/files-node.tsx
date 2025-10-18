'use client';

import { useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileIcon } from '@/components/icons';

interface SelectedFile {
  url: string;
  name: string;
  contentType: string;
}

interface FilesNodeData {
  label: string;
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  onDelete?: () => void;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
  isConnectedToExecuting?: boolean;
}

export function FilesNode({ data, selected }: NodeProps<FilesNodeData>) {

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    if (!data.connectingFrom) return '';
    
    const isHighlighted = data.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = data.connectingFrom && !isHighlighted;
    
    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  }, [data]);

  // Helper function to get execution styles for Files node
  const getExecutionStyles = useCallback(() => {
    if (data.isConnectedToExecuting) {
      return 'border-2 border-orange-500 bg-background/50 backdrop-blur-sm shadow-lg shadow-orange-500/30';
    }
    return 'border-2 border-border/60 hover:border-border bg-background/50 backdrop-blur-sm shadow-sm';
  }, [data.isConnectedToExecuting]);

  return (
    <>
      <div className='group relative'>
        {/* File Count Badge */}
        {data.selectedFiles.length > 0 && (
          <div className='-top-2 -right-2 absolute z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-orange-500 font-bold text-white text-xs shadow-lg dark:border-gray-800'>
            {data.selectedFiles.length}
          </div>
        )}
        
        {/* Circular Files Node */}
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${getExecutionStyles()} ${selected ? 'ring-2 ring-orange-500' : ''}`}
        >
          <FileIcon size={24} className="text-gray-600 dark:text-gray-300" />

          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="files"
            className={getHandleClassName('files', 'source')}
            style={{
              bottom: '-8px',
              left: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#6b7280',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              transform: 'translateX(-50%)',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            }}
          />
        </div>

      </div>
    </>
  );
}