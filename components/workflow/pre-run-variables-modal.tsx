'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Variable } from '@/components/workflow/variables-panel';

interface FilesNodeToAsk {
  id: string;
  variableName: string;
  description?: string;
  selectedFiles: Array<{ url: string; name: string; contentType: string }>;
}

interface PreRunVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: Variable[];
  filesNodes?: FilesNodeToAsk[];
  onConfirm: (updatedVariables: Variable[], updatedFilesNodes?: Map<string, Array<{ url: string; name: string; contentType: string }>>) => void;
}

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

export function PreRunVariablesModal({
  isOpen,
  onClose,
  variables,
  filesNodes = [],
  onConfirm,
}: PreRunVariablesModalProps) {
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  const [tempFiles, setTempFiles] = useState<Map<string, Array<{ url: string; name: string; contentType: string }>>>(new Map());
  const [expandedVariable, setExpandedVariable] = useState<string | null>(null);
  const [filePickerNodeId, setFilePickerNodeId] = useState<string | null>(null);

  // Filter to only show variables that should be asked before run
  const variablesToAsk = variables.filter(v => v.askBeforeRun);

  // Initialize temp values when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, string> = {};
      variablesToAsk.forEach(variable => {
        initialValues[variable.id] = variable.value;
      });
      setTempValues(initialValues);

      // Initialize file selections
      const initialFiles = new Map<string, Array<{ url: string; name: string; contentType: string }>>();
      filesNodes.forEach(node => {
        initialFiles.set(node.id, node.selectedFiles || []);
      });
      setTempFiles(initialFiles);
    }
  }, [isOpen, variables, filesNodes]);

  const handleConfirm = () => {
    // Update variables with new values
    const updatedVariables = variables.map(variable => {
      if (variable.askBeforeRun && tempValues[variable.id] !== undefined) {
        return { ...variable, value: tempValues[variable.id] };
      }
      return variable;
    });

    onConfirm(updatedVariables, tempFiles);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // If no variables or files to ask, don't show the modal
  if (!isOpen || (variablesToAsk.length === 0 && filesNodes.length === 0)) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancel}
        />

        {/* Modal */}
        <div className='zoom-in-95 relative w-[420px] max-w-[90vw] animate-in overflow-hidden rounded-xl border border-border bg-background shadow-xl duration-200'>
          {/* Header */}
          <div className='flex items-center justify-between border-border border-b px-4 py-3'>
            <h3 className='font-medium text-sm'>Context</h3>
            <button
              onClick={handleCancel}
              className='flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted'
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {/* Variables Section */}
              {variablesToAsk.map((variable) => (
                <div key={variable.id} className="space-y-1">
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5'>
                      <Label className='font-medium text-muted-foreground text-xs'>{variable.name}</Label>
                      <span className='rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]'>text</span>
                    </div>
                    <button
                      onClick={() => setExpandedVariable(variable.id)}
                      className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                      title="Agrandir"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                      </svg>
                    </button>
                  </div>
                  <textarea
                    id={`modal-var-${variable.id}`}
                    value={tempValues[variable.id] || ''}
                    onChange={(e) => setTempValues({
                      ...tempValues,
                      [variable.id]: e.target.value,
                    })}
                    placeholder="Entrez la valeur..."
                    rows={3}
                    className='w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed transition-colors placeholder:text-muted-foreground/50 focus:border-foreground focus:bg-background focus:outline-none'
                  />
                  {variable.description && (
                    <p className='text-muted-foreground text-xs leading-relaxed'>
                      {variable.description}
                    </p>
                  )}
                </div>
              ))}

              {/* Files Nodes Section */}
              {filesNodes.map((node) => (
                <div key={node.id} className="space-y-1">
                  <div className='flex items-center gap-1.5'>
                    <Label className='font-medium text-muted-foreground text-xs'>{node.variableName}</Label>
                    <span className='rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]'>files</span>
                  </div>

                  {/* File selection UI */}
                  <div className='space-y-2 rounded-lg border border-border bg-muted/30 p-3'>
                    {tempFiles.get(node.id) && tempFiles.get(node.id)!.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className='text-muted-foreground text-xs'>
                          {tempFiles.get(node.id)!.length} fichier(s) sélectionné(s)
                        </div>
                        <div className='max-h-[80px] space-y-0.5 overflow-y-auto'>
                          {tempFiles.get(node.id)!.map((file, index) => (
                            <div key={index} className='flex items-center justify-between gap-2 rounded bg-background px-2 py-1 text-[10px]'>
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              <button
                                onClick={() => {
                                  const updatedFiles = tempFiles.get(node.id)!.filter((_, i) => i !== index);
                                  const newTempFiles = new Map(tempFiles);
                                  newTempFiles.set(node.id, updatedFiles);
                                  setTempFiles(newTempFiles);
                                }}
                                className='flex h-3 w-3 flex-shrink-0 items-center justify-center text-red-600 transition-colors hover:text-red-700'
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className='text-center text-muted-foreground text-xs py-1'>
                        Aucun fichier sélectionné
                      </div>
                    )}

                    {/* Add Files Button */}
                    <button
                      onClick={() => setFilePickerNodeId(node.id)}
                      className='flex w-full items-center justify-center gap-2 rounded border border-border border-dashed bg-background px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted/40'
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      Sélectionner des fichiers
                    </button>
                  </div>

                  {node.description && (
                    <p className='text-muted-foreground text-xs leading-relaxed'>
                      {node.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className='flex gap-2 border-border border-t px-4 py-3'>
            <Button
              variant="outline"
              onClick={handleCancel}
              size="sm"
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              size="sm"
              className='flex-1'
            >
              Lancer
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded textarea modal */}
      {expandedVariable && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setExpandedVariable(null)}
          />

          <div className='zoom-in-95 relative flex h-[600px] max-h-[90vh] w-[800px] max-w-[90vw] animate-in flex-col rounded-xl border-2 border-border/60 bg-background shadow-2xl duration-200'>
            {/* Header */}
            <div className='border-border/60 border-b px-6 py-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-semibold text-lg'>
                  {variablesToAsk.find(v => v.id === expandedVariable)?.name}
                </h3>
                <button
                  onClick={() => setExpandedVariable(null)}
                  className='flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted/50'
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {variablesToAsk.find(v => v.id === expandedVariable)?.description && (
                <p className='mt-2 text-muted-foreground text-sm'>
                  {variablesToAsk.find(v => v.id === expandedVariable)?.description}
                </p>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              <textarea
                value={tempValues[expandedVariable] || ''}
                onChange={(e) => setTempValues({
                  ...tempValues,
                  [expandedVariable]: e.target.value,
                })}
                placeholder={`Entrer la valeur pour ${variablesToAsk.find(v => v.id === expandedVariable)?.name}...`}
                className='h-full w-full resize-none rounded-lg border-2 border-border/60 bg-background px-4 py-3 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                autoFocus
              />
            </div>

            {/* Footer */}
            <div className='border-border/60 border-t px-6 py-4'>
              <Button
                onClick={() => setExpandedVariable(null)}
                className='w-full bg-orange-600 text-white hover:bg-orange-700'
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* File Library Modal for file selection */}
      {filePickerNodeId && (
        <FileLibraryModalForPicker
          selectedFiles={tempFiles.get(filePickerNodeId) || []}
          onFilesChange={(files) => {
            const newTempFiles = new Map(tempFiles);
            newTempFiles.set(filePickerNodeId, files);
            setTempFiles(newTempFiles);
          }}
          onClose={() => setFilePickerNodeId(null)}
        />
      )}
    </>
  );
}

// File Library Modal Component for the pre-run picker
function FileLibraryModalForPicker({ selectedFiles, onFilesChange, onClose }: {
  selectedFiles: { url: string; name: string; contentType: string }[];
  onFilesChange: (files: { url: string; name: string; contentType: string }[]) => void;
  onClose: () => void;
}) {
  // Modal's own state
  const [allFiles, setAllFiles] = useState<UserFile[]>([]); // Cache all files
  const [allFolders, setAllFolders] = useState<any[]>([]); // Cache all folders
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Racine' }]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all data once on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load all folders and files in parallel
      const [foldersResponse, filesResponse] = await Promise.all([
        fetch('/api/library/folders'),
        fetch('/api/library/folders')
      ]);

      let allFoldersData: any[] = [];
      let rootFiles: UserFile[] = [];

      // Process folders
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        allFoldersData = foldersData.folders || [];
        setAllFolders(allFoldersData);
      }

      // Process root files
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        rootFiles = filesData.files || [];
      }

      // Load files from all folders in parallel
      const filePromises = allFoldersData.map(async (folder: any) => {
        try {
          const folderFilesResponse = await fetch(`/api/library/folders/${folder.id}/files`);
          if (folderFilesResponse.ok) {
            const folderFilesData = await folderFilesResponse.json();
            return folderFilesData.files || [];
          }
        } catch (error) {
          console.error(`Error loading files for folder ${folder.id}:`, error);
        }
        return [];
      });

      const folderFilesArrays = await Promise.all(filePromises);
      const allFilesFromFolders = folderFilesArrays.flat();

      // Combine root files and folder files
      setAllFiles([...rootFiles, ...allFilesFromFolders]);
    } catch (error) {
      console.error('Error loading library data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);
    const folderIndex = folderPath.findIndex(f => f.id === folderId);
    if (folderIndex >= 0) {
      setFolderPath(folderPath.slice(0, folderIndex + 1));
    } else {
      setFolderPath([...folderPath, { id: folderId, name: folderName }]);
    }
  };

  // Filter files by current folder and search query
  const currentFolderFiles = allFiles.filter(file => {
    const fileFolderId = file.folder_id === undefined ? null : file.folder_id;
    return fileFolderId === currentFolderId;
  });

  const filteredFiles = currentFolderFiles.filter(file =>
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter folders by current parent and search query
  const currentSubFolders = allFolders.filter(folder => {
    const folderParentId = folder.parent_id === undefined ? null : folder.parent_id;
    return folderParentId === currentFolderId;
  });

  const filteredFolders = currentSubFolders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isFileSelected = (fileUrl: string) => {
    return selectedFiles.some(f => f.url === fileUrl);
  };

  const toggleFile = (file: UserFile) => {
    if (isFileSelected(file.blob_url)) {
      onFilesChange(selectedFiles.filter(f => f.url !== file.blob_url));
    } else {
      onFilesChange([
        ...selectedFiles,
        {
          url: file.blob_url,
          name: file.original_name,
          contentType: file.mime_type,
        },
      ]);
    }
  };

  const getFilePreview = (file: UserFile) => {
    if (file.mime_type.startsWith('image/')) {
      return (
        <img
          src={file.blob_url}
          alt={file.original_name}
          className="h-full w-full object-cover"
        />
      );
    }
    // Default icon based on file type
    const icon = file.mime_type === 'application/pdf' ? '📄' :
                 file.mime_type.startsWith('text/') ? '📝' :
                 file.mime_type.startsWith('video/') ? '🎥' :
                 file.mime_type.startsWith('audio/') ? '🎵' : '📎';
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-4xl">
        {icon}
      </div>
    );
  };

  // Use portal to render modal at document level
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative h-[80vh] w-[90vw] max-w-6xl rounded-lg border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className='flex items-center justify-between border-border border-b p-4'>
          <h2 className='font-semibold text-lg'>Bibliothèque de fichiers</h2>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-muted"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className='border-border border-b px-6 py-4'>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {folderPath.map((folder, index) => (
              <div key={folder.id || 'root'} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted-foreground">/</span>}
                <button
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                  className={`text-sm transition-colors ${
                    index === folderPath.length - 1
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(80vh-180px)] overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="animate-spin" size={32} />
              <span className='ml-3 text-muted-foreground'>Chargement...</span>
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className='flex h-full items-center justify-center text-muted-foreground'>
              {searchQuery ? 'Aucun résultat trouvé' : 'Aucun fichier dans ce dossier'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {/* Folders */}
              {filteredFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                  className='group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-lg'
                >
                  <div className="flex aspect-square items-center justify-center bg-muted/50">
                    <span className='text-6xl'>📁</span>
                  </div>
                  <div className='border-border border-t p-2'>
                    <p className='truncate font-medium text-sm'>{folder.name}</p>
                  </div>
                </div>
              ))}

              {/* Files */}
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => toggleFile(file)}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow-lg ${
                    isFileSelected(file.blob_url)
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-border'
                  }`}
                >
                  {/* Checkbox */}
                  <div className='absolute top-2 right-2 z-10'>
                    <input
                      type="checkbox"
                      checked={isFileSelected(file.blob_url)}
                      onChange={() => toggleFile(file)}
                      className="h-4 w-4 cursor-pointer rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Preview */}
                  <div className="aspect-square overflow-hidden bg-muted">
                    {getFilePreview(file)}
                  </div>

                  {/* Info */}
                  <div className='border-border border-t bg-card p-2'>
                    <p className='truncate font-medium text-xs' title={file.original_name}>
                      {file.original_name}
                    </p>
                    <p className='text-[10px] text-muted-foreground'>
                      {(file.size_bytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex items-center justify-between border-border border-t p-4'>
          <span className='text-muted-foreground text-sm'>
            {selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''} sélectionné{selectedFiles.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className='rounded bg-blue-500 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-600'
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
