'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, File, Check, Loader2, Folder, ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface UserFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  blob_url: string;
  folder_id: string | null;
  created_at: string;
}

interface UserFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
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
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<UserFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    }
  }, [isOpen, currentFolderId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const url = `/api/library/folders${currentFolderId ? `?parent=${currentFolderId}` : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setFolders(data.folders || []);
      } else {
        console.error('Failed to load items');
        toast.error('Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors du chargement');
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

  const toggleFolderSelection = (folderId: string) => {
    const newSelection = new Set(selectedFolders);
    if (newSelection.has(folderId)) {
      newSelection.delete(folderId);
    } else {
      newSelection.add(folderId);
    }
    setSelectedFolders(newSelection);
  };

  const navigateToFolder = (folder: UserFolder | null) => {
    if (folder) {
      setCurrentFolderId(folder.id);
      setFolderPath(prev => [...prev, folder]);
    } else {
      setCurrentFolderId(null);
      setFolderPath([]);
    }
  };

  const navigateUp = () => {
    if (folderPath.length > 0) {
      const newPath = [...folderPath];
      newPath.pop();
      setFolderPath(newPath);
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  const handleConfirmSelection = async () => {
    const selectedFileObjects = files
      .filter(file => selectedFiles.has(file.id))
      .map(file => ({
        url: file.blob_url,
        name: file.original_name,
        contentType: file.mime_type,
      }));

    // Récupérer tous les fichiers des dossiers sélectionnés
    const folderFiles = [];
    for (const folderId of selectedFolders) {
      try {
        const response = await fetch(`/api/library/folders/${folderId}/files`);
        if (response.ok) {
          const data = await response.json();
          const folderFileObjects = data.files.map((file: UserFile) => ({
            url: file.blob_url,
            name: file.original_name,
            contentType: file.mime_type,
          }));
          folderFiles.push(...folderFileObjects);
        }
      } catch (error) {
        console.error('Error loading folder files:', error);
      }
    }

    const allSelectedFiles = [...selectedFileObjects, ...folderFiles];

    if (allSelectedFiles.length > 0) {
      onFilesSelected(allSelectedFiles);
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
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
      <DialogContent className='max-h-[80vh] sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Sélectionner des fichiers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bouton Upload nouveau */}
          <Button
            onClick={handleUploadNew}
            className='flex w-full items-center gap-2'
            variant="outline"
          >
            <Upload size={16} />
            Uploader un nouveau fichier
          </Button>

          {/* Liste des fichiers existants */}
          <div className="border-t pt-4">
            {/* Navigation */}
            {folderPath.length > 0 && (
              <div className='mb-3 flex items-center gap-2'>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateUp}
                  className="h-8 px-2 text-xs"
                >
                  <ChevronLeft size={14} />
                  Retour
                </Button>
                <span className='text-muted-foreground text-xs'>
                  {folderPath.map(folder => folder.name).join(' / ')}
                </span>
              </div>
            )}
            
            <h3 className='mb-3 font-medium text-sm'>
              Choisir depuis votre Library ({files.length} fichiers, {folders.length} dossiers)
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin" size={20} />
                <span className='ml-2 text-muted-foreground text-sm'>
                  Chargement...
                </span>
              </div>
            ) : files.length === 0 && folders.length === 0 ? (
              <div className='py-8 text-center text-muted-foreground'>
                <File size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucun fichier dans votre Library</p>
                <p className="text-xs">Uploadez d'abord des fichiers</p>
              </div>
            ) : (
              <div className='max-h-[300px] space-y-2 overflow-y-auto'>
                {/* Dossiers */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                      selectedFolders.has(folder.id)
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className='mr-3 text-lg' onClick={() => navigateToFolder(folder)}>
                      <Folder size={20} className="text-blue-600" />
                    </div>
                    
                    <div className='min-w-0 flex-1' onClick={() => navigateToFolder(folder)}>
                      <p className='truncate font-medium text-sm'>
                        📁 {folder.name}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        Dossier • {new Date(folder.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFolders.has(folder.id)}
                        onChange={() => toggleFolderSelection(folder.id)}
                        className="rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {selectedFolders.has(folder.id) && (
                        <Check size={16} className="text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Fichiers */}
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                      selectedFiles.has(file.id)
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    <div className='mr-3 text-lg'>
                      {getFileIcon(file.mime_type)}
                    </div>
                    
                    <div className='min-w-0 flex-1'>
                      <p className='truncate font-medium text-sm'>
                        {file.original_name}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {formatFileSize(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {selectedFiles.has(file.id) && (
                      <Check size={16} className='ml-2 text-blue-600' />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className='flex items-center justify-between border-t pt-4'>
            <p className='text-muted-foreground text-sm'>
              {selectedFiles.size} fichier(s) + {selectedFolders.size} dossier(s) sélectionné(s)
            </p>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedFiles.size === 0 && selectedFolders.size === 0}
              >
                Confirmer ({selectedFiles.size + selectedFolders.size})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}