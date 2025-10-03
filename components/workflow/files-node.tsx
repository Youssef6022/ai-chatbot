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
        {/* File Count Badge */}
        {data.selectedFiles.length > 0 && (
          <div className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg">
            {data.selectedFiles.length}
          </div>
        )}
        
        {/* Circular Files Node */}
        <div 
          className={`w-16 h-16 rounded-full border-2 border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer transition-colors flex items-center justify-center ${selected ? 'ring-2 ring-blue-500' : ''}`}
          onDoubleClick={() => setIsModalOpen(true)}
        >
          <FileIcon size={24} className="text-gray-600 dark:text-gray-300" />
          
          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="files"
            className={getHandleClassName('files', 'source')}
            style={{ 
              bottom: '-10px',
              left: '50%',
              width: '20px', 
              height: '20px', 
              backgroundColor: '#3b82f6', 
              border: '2px solid white',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
              transform: 'translateX(-50%)',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            }}
          />
        </div>

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