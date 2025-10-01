'use client';

import { useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrashIcon, FileIcon } from '@/components/icons';
import { FileSelectionModal } from '@/components/library/file-selection-modal';

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
}

export function FilesNode({ data, selected }: NodeProps<FilesNodeData>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (files: SelectedFile[]) => {
    // Éviter les doublons en utilisant l'URL comme clé unique
    const existingUrls = new Set(data.selectedFiles.map(f => f.url));
    const newFiles = files.filter(f => !existingUrls.has(f.url));
    const allFiles = [...data.selectedFiles, ...newFiles];
    data.onFilesChange?.(allFiles);
  };

  const handleRemoveFile = (url: string) => {
    const updatedFiles = data.selectedFiles.filter(f => f.url !== url);
    data.onFilesChange?.(updatedFiles);
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType === 'application/pdf') return '📄';
    if (contentType.startsWith('text/') || contentType === 'application/json') return '📝';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    return '📎';
  };

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
      <div className="relative group">
        <Card 
          className={`group min-w-[350px] border-2 border-blue-200 hover:border-blue-300 transition-colors cursor-pointer ${selected ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setIsModalOpen(true)}
        >
        <CardContent className='p-0'>
          {/* Main content with file icon and count */}
          <div className="flex h-32">
            {/* File Icon - Full height left side */}
            <div className="w-20 border-r border-blue-200 rounded-l-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900">
              <FileIcon size={32} className="text-blue-600 dark:text-blue-300" />
            </div>
            
            {/* Content area */}
            <div className="flex-1 flex items-center justify-between px-3">
              {/* File info */}
              <div className="flex flex-col justify-center gap-2 flex-1">
                <div className="text-sm font-medium text-gray-800">
                  Files
                </div>
                <div className="text-xs text-gray-600">
                  {data.selectedFiles.length} file{data.selectedFiles.length !== 1 ? 's' : ''} selected
                </div>
              </div>
              
              {/* Right side - Delete */}
              <div className="flex items-center gap-2">
                {data.onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onDelete?.();
                    }}
                    className='h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
                  >
                    <TrashIcon size={12} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="files"
            className={getHandleClassName('files', 'source')}
            style={{ 
              right: '-10px',
              width: '20px', 
              height: '20px', 
              backgroundColor: '#3b82f6', 
              border: '2px solid white',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
              transform: 'none',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            }}
          />
        </CardContent>
        </Card>

      </div>

      {/* File Selection Modal */}
      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFilesSelected}
        fileInputRef={fileInputRef}
      />
      
      {/* Hidden file input for file upload functionality */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={() => {}} // Handled by the modal
      />
    </>
  );
}