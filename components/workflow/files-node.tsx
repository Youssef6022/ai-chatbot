'use client';

import { useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrashIcon } from '@/components/icons';
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
      <Card className={`group min-w-[350px] border-2 border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className='flex items-center justify-between font-medium text-sm'>
            <span className="flex items-center gap-2">
              📁 Files
            </span>
            {data.onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={data.onDelete}
                className='h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
              >
                <TrashIcon size={12} />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-0'>
          {/* Output Handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="files"
            className={getHandleClassName('files', 'source')}
            style={{ 
              right: '-12px',
              width: '24px', 
              height: '24px', 
              backgroundColor: '#d1d5db', 
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transform: 'none',
              transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            }}
          />
          
          {/* File Selection Button */}
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            className="w-full"
          >
            Select Files from Library
          </Button>

          {/* Selected Files Display */}
          <div>
            <label className='mb-1 block font-medium text-muted-foreground text-xs'>
              Selected Files ({data.selectedFiles.length})
            </label>
            <Card className="border-dashed">
              <CardContent className="p-3">
                {data.selectedFiles.length === 0 ? (
                  <div className='text-muted-foreground text-sm italic text-center py-4'>
                    No files selected. Click "Select Files" to choose files from your library.
                  </div>
                ) : (
                  <ScrollArea className="h-[200px] w-full">
                    <div className="space-y-2">
                      {data.selectedFiles.map((file, index) => (
                        <div
                          key={`${file.url}-${index}`}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">
                              {getFileIcon(file.contentType)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate" title={file.name}>
                                {file.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {file.contentType}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(file.url)}
                            className="h-6 w-6 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                          >
                            <TrashIcon size={10} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Connection Info */}
          <div className='flex items-center gap-2 text-xs'>
            <div className='h-2 w-2 rounded-full bg-purple-500' />
            <span className='text-muted-foreground'>Files: Can connect to Generate Text</span>
          </div>
        </CardContent>
      </Card>

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