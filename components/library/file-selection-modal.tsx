'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, File, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface UserFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  blob_url: string;
  created_at: string;
}

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected: (files: Array<{ url: string; name: string; contentType: string }>) => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

export function FileSelectionModal({
  isOpen,
  onClose,
  onFilesSelected,
  fileInputRef,
}: FileSelectionModalProps) {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadFiles();
      setSelectedFiles(new Set()); // Reset selection
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading files:', error);
        toast.error('Erreur lors du chargement des fichiers');
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors du chargement des fichiers');
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleConfirmSelection = () => {
    const selectedFileObjects = files
      .filter(file => selectedFiles.has(file.id))
      .map(file => ({
        url: file.blob_url,
        name: file.original_name,
        contentType: file.mime_type,
      }));

    if (selectedFileObjects.length > 0) {
      onFilesSelected(selectedFileObjects);
      onClose();
    }
  };

  const handleUploadNew = () => {
    fileInputRef.current?.click();
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType.startsWith('text/')) {
      return '📄';
    } else if (mimeType === 'application/pdf') {
      return '📕';
    }
    return '📎';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sélectionner des fichiers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bouton Upload nouveau */}
          <Button
            onClick={handleUploadNew}
            className="w-full flex items-center gap-2"
            variant="outline"
          >
            <Upload size={16} />
            Uploader un nouveau fichier
          </Button>

          {/* Liste des fichiers existants */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-sm mb-3">
              Choisir depuis votre Library ({files.length} fichiers)
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin" size={20} />
                <span className="ml-2 text-sm text-muted-foreground">
                  Chargement...
                </span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucun fichier dans votre Library</p>
                <p className="text-xs">Uploadez d'abord des fichiers</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFiles.has(file.id)
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    <div className="text-lg mr-3">
                      {getFileIcon(file.mime_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {selectedFiles.has(file.id) && (
                      <Check size={16} className="text-blue-600 ml-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedFiles.size} fichier(s) sélectionné(s)
            </p>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedFiles.size === 0}
              >
                Confirmer ({selectedFiles.size})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}