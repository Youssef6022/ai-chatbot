'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadIcon, FileIcon, TrashIcon } from '@/components/icons';
import { toast } from '@/components/toast';

interface UserFile {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  blob_url: string;
  created_at: string;
}

export function LibraryPanel() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les fichiers
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/library/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      } else {
        toast({
          type: 'error',
          description: 'Failed to load files'
        });
      }
    } catch (error) {
      console.error('Load files error:', error);
      toast({
        type: 'error',
        description: 'Error loading files'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Upload fichier
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(prev => [data.file, ...prev]);
        toast({
          type: 'success',
          description: 'File uploaded successfully!'
        });
      } else {
        const error = await response.json();
        toast({
          type: 'error',
          description: error.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        type: 'error',
        description: 'Upload error'
      });
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Supprimer fichier
  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/library/delete?id=${fileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        toast({
          type: 'success',
          description: 'File deleted'
        });
      } else {
        toast({
          type: 'error',
          description: 'Delete failed'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        type: 'error',
        description: 'Delete error'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">📚 Library</h2>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          size="sm"
          className="gap-2"
        >
          <UploadIcon size={16} />
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>

      {/* File Input */}
      <Input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,.txt,.html,.json,.pdf,.md,.doc,.docx"
      />

      {/* Load Files Button */}
      {files.length === 0 && !isLoading && (
        <div className="p-4">
          <Button onClick={loadFiles} variant="outline" className="w-full">
            Load Files
          </Button>
        </div>
      )}

      {/* Files List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading && (
            <div className="text-center text-muted-foreground py-4">
              Loading files...
            </div>
          )}

          {files.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-8">
              <FileIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p>No files yet</p>
              <p className="text-xs">Upload your first file to get started</p>
            </div>
          )}

          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
            >
              <FileIcon size={20} className="text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {file.original_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(file.size_bytes)} • {file.mime_type}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(file.id)}
                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                <TrashIcon size={14} />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}