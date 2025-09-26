'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadIcon, FileIcon, TrashIcon, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chargement automatique au démarrage
  useEffect(() => {
    loadFiles();
  }, []);

  // Charger les fichiers
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/library/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        console.error('Failed to load files');
        // Don't show error toast on initial load for better UX
      }
    } catch (error) {
      console.error('Load files error:', error);
      // Don't show error toast on initial load for better UX
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
        toast.success('File uploaded successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload error');
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
        toast.success('File deleted');
      } else {
        toast.error('Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Delete error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('text/') || mimeType === 'application/json') return '📝';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  };


  return (
    <>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h2 className="font-semibold text-lg">Library</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">
              {files.length} files
            </span>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            size="sm"
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon size={16} />
                Upload
              </>
            )}
          </Button>
        </div>

        {/* File Input */}
        <Input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.txt,.html,.json,.pdf,.md,.doc,.docx,audio/*,video/*"
        />

        {/* Files List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p>Loading your files...</p>
              </div>
            )}

            {/* Empty State */}
            {files.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mb-4 border">
                  <FileIcon size={24} className="text-blue-500" />
                </div>
                <h3 className="font-medium mb-2">No files yet</h3>
                <p className="text-sm text-center max-w-48">
                  Upload your first file to start building your library
                </p>
              </div>
            )}

            {/* Files Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative p-3 border border-border rounded-lg bg-card hover:shadow-md hover:border-blue-200 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* File Preview/Icon */}
                  <div className="w-full aspect-square mb-3 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/30 border flex items-center justify-center">
                    {file.mime_type.startsWith('image/') ? (
                      <img
                        src={file.blob_url}
                        alt={file.original_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">{getFileIcon(file.mime_type)}</span>
                    )}
                  </div>
                  
                  {/* File Info */}
                  <div className="space-y-1">
                    <div className="font-medium text-sm truncate group-hover:text-blue-600 transition-colors" title={file.original_name}>
                      {file.original_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size_bytes)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-md p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.blob_url, '_blank')}
                      className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                      title="Open file in new tab"
                    >
                      <Eye size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.id)}
                      className="h-6 w-6 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete file"
                    >
                      <TrashIcon size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

    </>
  );
}