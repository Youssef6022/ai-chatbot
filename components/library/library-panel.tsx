'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadIcon, FileIcon, TrashIcon, Eye, Loader2, FolderPlus, Folder, ChevronLeft, ChevronRight, MoreHorizontal, Move } from 'lucide-react';
import { toast } from 'sonner';

interface UserFile {
  id: string;
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

export function LibraryPanel() {
  const [allFiles, setAllFiles] = useState<UserFile[]>([]);
  const [allFolders, setAllFolders] = useState<UserFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<UserFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{id: string, type: 'file' | 'folder', name: string} | null>(null);

  // Computed values pour les fichiers et dossiers actuels
  const files = allFiles.filter(file => file.folder_id === currentFolderId);
  const folders = allFolders.filter(folder => folder.parent_folder_id === currentFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chargement automatique au démarrage seulement
  useEffect(() => {
    loadAllItems();
  }, []);

  // Charger tous les fichiers et dossiers une seule fois
  const loadAllItems = async () => {
    setIsLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        setAllFiles([]);
        setAllFolders([]);
        return;
      }

      // Récupérer TOUS les dossiers
      const { data: foldersData, error: foldersError } = await supabase
        .from('user_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      // Récupérer TOUS les fichiers
      const { data: filesData, error: filesError } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .order('original_name');

      if (foldersError) {
        console.error('Folders error:', foldersError);
        toast.error('Erreur lors du chargement des dossiers');
      }

      if (filesError) {
        console.error('Files error:', filesError);
        toast.error('Erreur lors du chargement des fichiers');
      }

      setAllFolders(foldersData || []);
      setAllFiles(filesData || []);

    } catch (error) {
      console.error('Load items error:', error);
      toast.error('Erreur lors du chargement');
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
    if (currentFolderId) {
      formData.append('folderId', currentFolderId);
    }

    try {
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAllFiles(prev => [data.file, ...prev]);
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

  // Charger tous les dossiers pour le sélecteur de déplacement
  const loadAllFolders = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allFoldersData, error } = await supabase
        .from('user_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (!error) {
        setAllFolders(allFoldersData || []);
      }
    } catch (error) {
      console.error('Load all folders error:', error);
    }
  };

  // Créer un dossier
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Utilisateur non authentifié');
        return;
      }

      // Vérifier que le nom n'existe pas déjà
      let existingQuery = supabase
        .from('user_folders')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', newFolderName.trim());
      
      if (currentFolderId) {
        existingQuery = existingQuery.eq('parent_folder_id', currentFolderId);
      } else {
        existingQuery = existingQuery.is('parent_folder_id', null);
      }
      
      const { data: existing } = await existingQuery.single();

      if (existing) {
        toast.error('Un dossier avec ce nom existe déjà');
        return;
      }

      // Créer le dossier
      const { data: folder, error } = await supabase
        .from('user_folders')
        .insert({
          user_id: user.id,
          name: newFolderName.trim(),
          parent_folder_id: currentFolderId,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        toast.error('Erreur lors de la création du dossier');
        return;
      }

      setAllFolders(prev => [folder, ...prev]);
      setNewFolderName('');
      setIsCreateFolderOpen(false);
      toast.success('Dossier créé avec succès !');

    } catch (error) {
      console.error('Create folder error:', error);
      toast.error('Erreur lors de la création du dossier');
    }
  };

  // Navigation dans les dossiers (instantanée, pas de rechargement)
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

  // Ouvrir le dialogue de déplacement
  const openMoveDialog = (item: {id: string, type: 'file' | 'folder', name: string}) => {
    setSelectedItem(item);
    setIsMoveDialogOpen(true);
  };

  // Déplacer un élément
  const handleMoveItem = async (targetFolderId: string) => {
    if (!selectedItem) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Utilisateur non authentifié');
        return;
      }

      const targetFolder = targetFolderId === 'root' ? null : targetFolderId;

      if (selectedItem.type === 'file') {
        // Déplacer un fichier
        const { error } = await supabase
          .from('user_files')
          .update({ folder_id: targetFolder })
          .eq('id', selectedItem.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('File move error:', error);
          toast.error('Erreur lors du déplacement du fichier');
          return;
        }

        // Mettre à jour le state local
        setAllFiles(prev => prev.map(file => 
          file.id === selectedItem.id 
            ? { ...file, folder_id: targetFolder }
            : file
        ));
      } else {
        // Déplacer un dossier
        const { error } = await supabase
          .from('user_folders')
          .update({ parent_folder_id: targetFolder })
          .eq('id', selectedItem.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Folder move error:', error);
          toast.error('Erreur lors du déplacement du dossier');
          return;
        }

        // Mettre à jour le state local
        setAllFolders(prev => prev.map(folder => 
          folder.id === selectedItem.id 
            ? { ...folder, parent_folder_id: targetFolder }
            : folder
        ));
      }

      setIsMoveDialogOpen(false);
      setSelectedItem(null);
      toast.success(`${selectedItem.type === 'file' ? 'Fichier' : 'Dossier'} déplacé avec succès !`);

    } catch (error) {
      console.error('Move error:', error);
      toast.error('Erreur lors du déplacement');
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
        setAllFiles(prev => prev.filter(f => f.id !== fileId));
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
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="text-background"
              >
                <path 
                  d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" 
                  fill="currentColor"
                />
              </svg>
            </div>
            <h2 className="font-semibold text-lg">Library</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
              {files.length} files, {folders.length} folders
            </span>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <FolderPlus size={16} />
                  Folder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un nouveau dossier</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nom du dossier"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                      Créer
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
          <div className="p-4 space-y-3 min-h-full">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p>Loading your files...</p>
              </div>
            )}

            {/* Breadcrumbs Navigation */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateUp}
                disabled={folderPath.length === 0}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft size={14} />
                Retour
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCurrentFolderId(null);
                    setFolderPath([]);
                  }}
                  className="h-8 px-2 text-xs font-mono"
                >
                  /
                </Button>
                {folderPath.map((folder, index) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newPath = folderPath.slice(0, index + 1);
                        setFolderPath(newPath);
                        setCurrentFolderId(folder.id);
                      }}
                      className="h-8 px-2 text-xs font-mono"
                    >
                      {folder.name}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty State */}
            {files.length === 0 && folders.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border">
                  <FileIcon size={24} className="text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">No files yet</h3>
                <p className="text-sm text-center max-w-48">
                  Upload your first file to start building your library
                </p>
              </div>
            )}

            {/* Files and Folders Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {/* Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group relative p-3 border border-border rounded-lg bg-card hover:shadow-md hover:border-blue-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => navigateToFolder(folder)}
                >
                  {/* Folder Icon */}
                  <div className="w-full aspect-square mb-2 flex items-center justify-center">
                    <svg 
                      width="64" 
                      height="64" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="text-yellow-500"
                    >
                      <path 
                        d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" 
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  
                  {/* Folder Info */}
                  <div className="space-y-1">
                    <div className="font-medium text-sm truncate group-hover:text-blue-600 transition-colors" title={folder.name}>
                      📁 {folder.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dossier
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-md p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMoveDialog({id: folder.id, type: 'folder', name: folder.name});
                      }}
                      className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                      title="Déplacer le dossier"
                    >
                      <Move size={12} />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Files */}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative p-3 border border-border rounded-lg bg-card hover:shadow-md hover:border-blue-200 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* File Preview/Icon */}
                  <div className="w-full aspect-square mb-2 flex items-center justify-center">
                    {file.mime_type.startsWith('image/') ? (
                      <img
                        src={file.blob_url}
                        alt={file.original_name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-6xl">{getFileIcon(file.mime_type)}</span>
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
                      onClick={() => openMoveDialog({id: file.id, type: 'file', name: file.original_name})}
                      className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                      title="Déplacer le fichier"
                    >
                      <Move size={12} />
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

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déplacer {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez le dossier de destination :
            </p>
            <Select onValueChange={handleMoveItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un dossier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">📁 Racine (/)</SelectItem>
                {allFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    📁 {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}