'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnectStart,
  type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow-styles.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenerateNode } from '@/components/workflow/generate-node';
import { FilesNode } from '@/components/workflow/files-node';
import { NoteNode } from '@/components/workflow/note-node';
import { DecisionNode } from '@/components/workflow/decision-node';
import { CustomEdge } from '@/components/workflow/custom-edge';
import type { Variable } from '@/components/workflow/variables-panel';
import { WorkflowConsole } from '@/components/workflow/workflow-console';
import { HighlightedTextarea } from '@/components/workflow/highlighted-textarea';
import { PreRunVariablesModal } from '@/components/workflow/pre-run-variables-modal';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Files Selector Component
interface FilesSelectorProps {
  selectedFiles: Array<{ url: string; name: string; contentType: string }>;
  onFilesChange: (files: Array<{ url: string; name: string; contentType: string }>) => void;
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

function FilesSelector({ selectedFiles, onFilesChange }: FilesSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1">
          <Label className='font-medium text-[10px] text-muted-foreground'>
            Fichiers sélectionnés ({selectedFiles.length})
          </Label>
          <div className='max-h-[120px] space-y-0.5 overflow-y-auto rounded border border-border p-1'>
            {selectedFiles.map((file, index) => (
              <div key={index} className='flex items-center justify-between gap-1 rounded bg-muted px-1.5 py-1 text-[10px]'>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  onClick={() => onFilesChange(selectedFiles.filter((_, i) => i !== index))}
                  className='flex h-3 w-3 flex-shrink-0 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-500/20'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Files Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className='flex w-full items-center justify-center gap-2 rounded border border-border border-dashed bg-muted/20 px-3 py-2 text-muted-foreground text-xs transition-colors hover:bg-muted/40'
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Ajouter des fichiers
      </button>

      {/* File Library Modal */}
      {isModalOpen && (
        <FileLibraryModal
          selectedFiles={selectedFiles}
          onFilesChange={onFilesChange}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

// File Library Modal Component with own state
function FileLibraryModal({ selectedFiles, onFilesChange, onClose }: {
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

// Settings Icon
const SettingsIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width={size}
    style={{ color: 'currentcolor' }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0-1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.42 2h3.16c.2 0 .39.11.49.28l1.92 3.32c.1.17.1.39 0 .56L10.07 9.5c-.1.17-.29.28-.49.28H6.42c-.2 0-.39-.11-.49-.28L4.01 6.16c-.1-.17-.1-.39 0-.56L5.93 2.28c.1-.17.29-.28.49-.28zM5.5 8.5h5l1.5-2.5L10.5 3.5h-5L4 6l1.5 2.5z"
      fill="currentColor"
    />
    <path
      d="M8 0v2M8 14v2M2.1 2.1l1.4 1.4M12.5 12.5l1.4 1.4M0 8h2M14 8h2M2.1 13.9l1.4-1.4M12.5 3.5l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

// Google Search Icon (same as in chat)
const GoogleSearchIcon = ({ size = 14, enabled = false }: { size?: number; enabled?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-3 0 262 262"
    width={size}
    height={size}
    style={{
      filter: enabled ? 'none' : 'grayscale(100%)',
      opacity: enabled ? 1 : 0.5,
      transition: 'filter 0.2s ease, opacity 0.2s ease'
    }}
  >
    <path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/>
    <path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/>
    <path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/>
    <path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/>
  </svg>
);

// Google Maps Icon (same as in chat)
const GoogleMapsIcon = ({ size = 14, enabled = false }: { size?: number; enabled?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-55.5 0 367 367"
    width={size}
    height={size}
    style={{
      filter: enabled ? 'none' : 'grayscale(100%)',
      opacity: enabled ? 1 : 0.5,
      transition: 'filter 0.2s ease, opacity 0.2s ease'
    }}
  >
    <path fill="#34a853" d="M70.585 271.865a371 371 0 0 1 28.911 42.642c7.374 13.982 10.448 23.463 15.837 40.31c3.305 9.308 6.292 12.086 12.714 12.086c6.998 0 10.173-4.726 12.626-12.035c5.094-15.91 9.091-28.052 15.397-39.525c12.374-22.15 27.75-41.833 42.858-60.75c4.09-5.354 30.534-36.545 42.439-61.156c0 0 14.632-27.035 14.632-64.792c0-35.318-14.43-59.813-14.43-59.813l-41.545 11.126l-25.23 66.451l-6.242 9.163l-1.248 1.66l-1.66 2.078l-2.914 3.319l-4.164 4.163l-22.467 18.304l-56.17 32.432z"/>
    <path fill="#fbbc04" d="M12.612 188.892c13.709 31.313 40.145 58.839 58.031 82.995l95.001-112.534s-13.384 17.504-37.662 17.504c-27.043 0-48.89-21.595-48.89-48.825c0-18.673 11.234-31.501 11.234-31.501l-64.489 17.28z"/>
    <path fill="#4285f4" d="M166.705 5.787c31.552 10.173 58.558 31.53 74.893 63.023l-75.925 90.478s11.234-13.06 11.234-31.617c0-27.864-23.463-48.68-48.81-48.68c-23.969 0-37.735 17.475-37.735 17.475v-57z"/>
    <path fill="#1a73e8" d="M30.015 45.765C48.86 23.218 82.02 0 127.736 0c22.18 0 38.89 5.823 38.89 5.823L90.29 96.516H36.205z"/>
    <path fill="#ea4335" d="M12.612 188.892S0 164.194 0 128.414c0-33.817 13.146-63.377 30.015-82.649l60.318 50.759z"/>
  </svg>
);

// RAG Book Icon - Civil Code (Burgundy/Red)
const RAGCivilIcon = ({ size = 14, enabled = false }: { size?: number; enabled?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{
      filter: enabled ? 'none' : 'grayscale(100%)',
      opacity: enabled ? 1 : 0.5,
      transition: 'filter 0.2s ease, opacity 0.2s ease'
    }}
  >
    <path fill="#8B1538" d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
    <path fill="#A91D3A" d="M8 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8V2z"/>
    <path fill="#FFF" d="M10 8h6v1h-6zm0 3h6v1h-6zm0 3h4v1h-4z" opacity="0.9"/>
  </svg>
);

// RAG Book Icon - Commerce Code (Blue)
const RAGCommerceIcon = ({ size = 14, enabled = false }: { size?: number; enabled?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{
      filter: enabled ? 'none' : 'grayscale(100%)',
      opacity: enabled ? 1 : 0.5,
      transition: 'filter 0.2s ease, opacity 0.2s ease'
    }}
  >
    <path fill="#1565C0" d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
    <path fill="#1976D2" d="M8 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8V2z"/>
    <path fill="#FFF" d="M10 8h6v1h-6zm0 3h6v1h-6zm0 3h4v1h-4z" opacity="0.9"/>
  </svg>
);

// Legal Icon - Courthouse (Purple)
const LegalIcon = ({ size = 14, enabled = false }: { size?: number; enabled?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width={size}
    height={size}
    style={{
      fill: enabled ? '#a855f7' : 'currentColor',
      opacity: enabled ? 1 : 0.5,
      transition: 'fill 0.2s ease, opacity 0.2s ease'
    }}
  >
    <path d="m0 467h512v45h-512z"/>
    <path d="m46 392h420v45h-420z"/>
    <path d="m271 90h-30v302h30z"/>
    <path d="m91 180h60v212h-60z"/>
    <path d="m181 180h60v212h-60z"/>
    <path d="m361 180h60v212h-60z"/>
    <path d="m271 180h60v212h-60z"/>
    <path d="m31 150h450v60h-450z"/>
    <path d="m256 0-225 120h450z"/>
  </svg>
);

const nodeTypes = {
  generate: GenerateNode,
  files: FilesNode,
  note: NoteNode,
  decision: DecisionNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const initialNodes = [
  {
    id: '1',
    type: 'generate',
    position: { x: 300, y: 200 },
    data: { 
      label: 'Generate Text',
      selectedModel: 'chat-model-medium',
      result: '',
      variableName: 'AI Agent 1',
      systemPrompt: '',
      userPrompt: '',
      isSearchGroundingEnabled: false,
      isMapsGroundingEnabled: false,
      isLegalEnabled: false,
      onModelChange: () => {},
      onVariableNameChange: () => {},
      onSystemPromptChange: () => {},
      onUserPromptChange: () => {},
      onDelete: () => {},
    },
  },
];

const initialEdges: Edge[] = [];

// Component to handle auto-fit view when nodes change
function AutoFitView({ nodes }: { nodes: any[] }) {
  const { fitView } = useReactFlow();
  const prevNodesLength = useRef(nodes.length);

  useEffect(() => {
    // Fit view when nodes are added/removed or on initial load
    if (nodes.length > 0 && prevNodesLength.current !== nodes.length) {
      prevNodesLength.current = nodes.length;

      const timer = setTimeout(() => {
        fitView({
          padding: 0.3,
          duration: 500,
          maxZoom: 0.9,
          minZoom: 0.2
        });
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  // Also fit on initial mount
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({
          padding: 0.3,
          duration: 500,
          maxZoom: 0.9,
          minZoom: 0.2
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, []); // Empty deps = run once on mount

  return null;
}

export default function WorkflowsPage() {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [workflowTitle, setWorkflowTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState(false);
  const searchParams = useSearchParams();
  
  // Connection highlighting state
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handleId: string; handleType: 'source' | 'target' } | null>(null);
  
  // Edge selection state for delete button
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  
  // Console state
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Edit panel state
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string>('');
  
  // Toolbar state
  const [selectedTool, setSelectedTool] = useState<'select' | 'move'>('move');
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);

  // Pre-run variables modal state
  const [showPreRunModal, setShowPreRunModal] = useState(false);

  // Delete variable confirmation state
  const [deleteVariableConfirmation, setDeleteVariableConfirmation] = useState<{
    variableId: string;
    variableName: string;
    usedInNodes: Array<{ id: string; label: string; type: string }>;
  } | null>(null);

  // Flag to prevent double execution
  const isExecutingRef = useRef(false);

  // Set to track nodes currently being processed (prevents double execution)
  const processingNodesRef = useRef(new Set<string>());

  // Ref to store current variables (updated before workflow execution)
  const currentVariablesRef = useRef<Variable[]>(variables);

  // Undo/Redo system with refs to avoid circular dependencies
  const [history, setHistory] = useState<Array<{nodes: any[], edges: any[], timestamp: number}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  
  // Keep refs in sync (with debouncing to avoid loops)
  useEffect(() => {
    const timer = setTimeout(() => {
      historyRef.current = history;
    }, 0);
    return () => clearTimeout(timer);
  }, [history]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      historyIndexRef.current = historyIndex;
    }, 0);
    return () => clearTimeout(timer);
  }, [historyIndex]);
  
  // Get execution order for nodes
  const getExecutionOrder = useCallback(() => {
    const visited = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // First visit all dependencies (nodes that this node depends on)
      const incomingEdges = edges.filter(edge => edge.target === nodeId);
      incomingEdges.forEach(edge => {
        visit(edge.source);
      });
      
      // Then add this node to execution order
      order.push(nodeId);
    };
    
    // Start with generate and decision nodes
    nodes.filter(node => node.type === 'generate' || node.type === 'decision').forEach(node => {
      visit(node.id);
    });

    return order.filter(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.type === 'generate' || node?.type === 'decision';
    });
  }, [nodes, edges]);
  
  // Helper function to get all ancestor nodes (nodes that the current node depends on)
  const getNodeAncestors = useCallback((nodeId: string) => {
    const ancestors = new Set<string>();
    const toVisit = [nodeId];
    const visited = new Set<string>();
    
    while (toVisit.length > 0) {
      const currentId = toVisit.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      // Find all incoming edges (dependencies)
      const incomingEdges = edges.filter(edge => edge.target === currentId);
      incomingEdges.forEach(edge => {
        ancestors.add(edge.source);
        toVisit.push(edge.source);
      });
    }
    
    return ancestors;
  }, [edges]);

  // Get predefined variables (system variables that cannot be edited)
  const predefinedVariables = useMemo((): Variable[] => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return [
      {
        id: 'predefined-date',
        name: 'date',
        value: formattedDate,
        defaultValue: formattedDate,
        askBeforeRun: false
      }
    ];
  }, []);

  // Get all available variables (predefined + global + AI Generator results)
  const getAllAvailableVariables = useCallback((currentNodeId?: string) => {
    const allVariables: Variable[] = [...predefinedVariables, ...variables];
    
    if (currentNodeId) {
      // Get all ancestor nodes (nodes that the current node depends on)
      const ancestors = getNodeAncestors(currentNodeId);
      
      // Add AI Generator and Decision Node results as variables, but only from ancestor nodes
      const aiNodes = nodes.filter(node =>
        (node.type === 'generate' || node.type === 'decision') &&
        node.data.variableName &&
        node.id !== currentNodeId &&  // Exclude current node
        ancestors.has(node.id)        // Only include ancestors
      );

      aiNodes.forEach(node => {
        allVariables.push({
          id: `ai-node-${node.id}`,
          name: node.data.variableName,
          value: node.data.result || ''
        });
      });
    } else {
      // If no current node specified, include all generate and decision nodes (for general validation)
      const aiNodes = nodes.filter(node =>
        (node.type === 'generate' || node.type === 'decision') &&
        node.data.variableName
      );

      aiNodes.forEach(node => {
        allVariables.push({
          id: `ai-node-${node.id}`,
          name: node.data.variableName,
          value: node.data.result || ''
        });
      });
    }
    
    return allVariables;
  }, [predefinedVariables, variables, nodes, edges, getNodeAncestors]);
  
  // Save state to history
  const saveToHistory = useCallback((newNodes: any[], newEdges: any[]) => {
    const newState = {
      nodes: JSON.parse(JSON.stringify(newNodes)),
      edges: JSON.parse(JSON.stringify(newEdges)),
      timestamp: Date.now()
    };
    
    const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    currentHistory.push(newState);
    const finalHistory = currentHistory.slice(-50);
    
    setHistory(finalHistory);
    setHistoryIndex(finalHistory.length - 1);
  }, []);
  
  // Undo function
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const prevState = historyRef.current[historyIndexRef.current - 1];
      setNodes(prevState.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onModelChange: () => {},
          onVariableNameChange: () => {},
          onSystemPromptChange: () => {},
          onUserPromptChange: () => {},
          onFilesChange: () => {},
          onContentChange: () => {},
          onDelete: () => {},
        }
      })));
      setEdges(prevState.edges);
      setHistoryIndex(historyIndexRef.current - 1);
    }
  }, [setNodes, setEdges]);
  
  // Redo function
  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const nextState = historyRef.current[historyIndexRef.current + 1];
      setNodes(nextState.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onModelChange: () => {},
          onVariableNameChange: () => {},
          onSystemPromptChange: () => {},
          onUserPromptChange: () => {},
          onFilesChange: () => {},
          onContentChange: () => {},
          onDelete: () => {},
        }
      })));
      setEdges(nextState.edges);
      setHistoryIndex(historyIndexRef.current + 1);
    }
  }, [setNodes, setEdges]);
  
  // Check if undo/redo are available
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Custom onNodesChange that saves to history for position changes
  const onNodesChange = useCallback((changes: any[]) => {
    onNodesChangeInternal(changes);
    
    // Check if this is a position change (drag end)
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.dragging === false
    );
    
    if (positionChanges.length > 0) {
      // Save to history after position change
      setTimeout(() => {
        setNodes(currentNodes => {
          saveToHistory(currentNodes, edges);
          return currentNodes;
        });
      }, 50);
    }
  }, [onNodesChangeInternal, edges, saveToHistory]);
  
  // Use the internal onEdgesChange directly
  const onEdgesChange = onEdgesChangeInternal;
  const [executionLogs, setExecutionLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>>([]);

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  // Variable modal state
  const [variableModal, setVariableModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    variable?: Variable;
  }>({ isOpen: false, mode: 'add' });

  // Local state for the modal's askBeforeRun toggle
  const [modalAskBeforeRun, setModalAskBeforeRun] = useState(false);

  // Variable validation state
  const [invalidVariables, setInvalidVariables] = useState<{
    [nodeId: string]: { hasInvalid: boolean; variables: string[] };
  }>({});

  // Show notification helper
  const showNotification = useCallback((message: string, type: 'error' | 'warning' | 'success' | 'info' = 'info') => {
    setNotification({ message, type, visible: true });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  }, []);

  // Memoized validation callbacks to prevent infinite loops
  const handleSystemPromptValidation = useCallback((hasInvalid: boolean, invalidVars: string[]) => {
    if (editingNode) {
      setInvalidVariables(prev => ({
        ...prev,
        [`${editingNode.id}-system`]: { hasInvalid, variables: invalidVars }
      }));
    }
  }, [editingNode?.id]);

  const handleUserPromptValidation = useCallback((hasInvalid: boolean, invalidVars: string[]) => {
    if (editingNode) {
      setInvalidVariables(prev => ({
        ...prev,
        [`${editingNode.id}-user`]: { hasInvalid, variables: invalidVars }
      }));
    }
  }, [editingNode?.id]);

  

  // Track theme for dots color
  const [dotsColor, setDotsColor] = useState('#e2e8f0');

  
  // Initialize history with current workflow state
  const isInitialized = useRef(false);
  useEffect(() => {
    if (!isInitialized.current) {
      // Always initialize with current state, even if empty
      const initialState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now()
      };
      setHistory([initialState]);
      setHistoryIndex(0);
      isInitialized.current = true;
    }
  }, [nodes, edges]); // Depend on nodes and edges to capture loaded workflow

  // Load workflow from database when URL has ID parameter or import workflow data
  useEffect(() => {
    const workflowId = searchParams.get('id');
    const importData = searchParams.get('import');
    const title = searchParams.get('title');
    const description = searchParams.get('description');
    
    if (workflowId && workflowId !== currentWorkflowId) {
      loadWorkflowFromDatabase(workflowId);
    } else if (importData && title) {
      // Import avec nom/description spécifiés
      loadImportedWorkflowWithTitle(importData, title, description || '');
    } else if (importData) {
      // Import sans nom/description (ancien comportement)
      loadImportedWorkflow(importData);
    } else if (title) {
      handleNewWorkflowCreation(title, description || '');
    }
  }, [searchParams]);

  // Load workflow from database
  const loadWorkflowFromDatabase = async (workflowId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (response.ok) {
        const workflow = await response.json();
        setCurrentWorkflowId(workflowId);
        setSaveTitle(workflow.title);
        setSaveDescription(workflow.description || '');
        setWorkflowTitle(workflow.title);
        
        // Load the workflow data
        const workflowData = workflow.workflowData;
        
        if (workflowData?.nodes && workflowData.edges) {
          // Restore nodes with proper callback functions
          const importedNodes = workflowData.nodes.map((node: any) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: {
              ...node.data,
              onTextChange: () => {},
              onModelChange: () => {},
              onVariableNameChange: () => {},
              onFilesChange: () => {},
              onDelete: () => {},
            }
          }));

          // Restore edges
          const importedEdges = workflowData.edges.map((edge: any) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          }));

          // Restore variables if they exist
          const importedVariables = workflowData.variables || [];

          setNodes(importedNodes);
          setEdges(importedEdges);
          setVariables(importedVariables);

          // Reset history with loaded workflow
          const loadedState = {
            nodes: JSON.parse(JSON.stringify(importedNodes)),
            edges: JSON.parse(JSON.stringify(importedEdges)),
            timestamp: Date.now()
          };
          setHistory([loadedState]);
          setHistoryIndex(0);

          toast.success(`Workflow "${workflow.title}" chargé avec succès`);
        }
      } else {
        toast.error('Workflow non trouvé');
        setCurrentWorkflowId(null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du workflow:', error);
      toast.error('Erreur lors du chargement du workflow');
      setCurrentWorkflowId(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load imported workflow from URL parameter
  const loadImportedWorkflow = (importData: string) => {
    try {
      const workflowData = JSON.parse(decodeURIComponent(importData));
      
      if (workflowData?.nodes && workflowData.edges) {
        // Restore nodes with proper callback functions
        const importedNodes = workflowData.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            onTextChange: () => {},
            onModelChange: () => {},
            onVariableNameChange: () => {},
            onFilesChange: () => {},
            onDelete: () => {},
          }
        }));
        
        // Restore edges
        const importedEdges = workflowData.edges.map((edge: any) => ({
          ...edge,
          type: 'custom'
        }));
        
        // Restore variables if they exist
        const importedVariables = workflowData.variables || [];
        
        setNodes(importedNodes);
        setEdges(importedEdges);
        setVariables(importedVariables);
        
        // Reset history with imported workflow
        const newState = {
          nodes: JSON.parse(JSON.stringify(importedNodes)),
          edges: JSON.parse(JSON.stringify(importedEdges)),
          timestamp: Date.now()
        };
        setHistory([newState]);
        setHistoryIndex(0);
        
        // Set imported workflow title
        setSaveTitle(workflowData.title || 'Imported Workflow');
        setWorkflowTitle(workflowData.title || 'Imported Workflow');
        setSaveDescription(workflowData.description || '');
        
        // Clear current workflow ID since this is a new import
        setCurrentWorkflowId(null);
        
        toast.success('Workflow importé avec succès');
        
        // Clear the import parameter from URL to avoid re-importing
        const url = new URL(window.location.href);
        url.searchParams.delete('import');
        window.history.replaceState({}, '', url.toString());
      } else {
        toast.error('Format de workflow invalide');
      }
    } catch (error) {
      console.error('Erreur lors de l\'importation du workflow:', error);
      toast.error('Erreur lors de l\'importation du workflow');
    }
  };

  // Load imported workflow with title and description from URL parameters
  const loadImportedWorkflowWithTitle = async (importData: string, title: string, description: string) => {
    setIsLoading(true);
    
    try {
      const workflowData = JSON.parse(decodeURIComponent(importData));
      
      if (workflowData?.nodes && workflowData.edges) {
        // Restore nodes with proper callback functions
        const importedNodes = workflowData.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            onTextChange: () => {},
            onModelChange: () => {},
            onVariableNameChange: () => {},
            onFilesChange: () => {},
            onDelete: () => {},
            onSearchGroundingChange: () => {},
            onReasoningChange: () => {},
          }
        }));
        
        // Restore edges
        const importedEdges = workflowData.edges.map((edge: any) => ({
          ...edge,
          type: 'custom'
        }));
        
        // Restore variables if they exist
        const importedVariables = workflowData.variables || [];
        
        // Create workflow in database with provided title and description
        const response = await fetch('/api/workflows', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            description,
            workflowData: {
              nodes: importedNodes,
              edges: importedEdges,
              variables: importedVariables
            },
            isPublic: false,
          }),
        });
        
        if (response.ok) {
          const savedWorkflow = await response.json();
          setCurrentWorkflowId(savedWorkflow.id);
          
          setNodes(importedNodes);
          setEdges(importedEdges);
          setVariables(importedVariables);
          
          // Reset history with imported workflow
          const newState = {
            nodes: JSON.parse(JSON.stringify(importedNodes)),
            edges: JSON.parse(JSON.stringify(importedEdges)),
            timestamp: Date.now()
          };
          setHistory([newState]);
          setHistoryIndex(0);
          
          // Set the provided title and description
          setSaveTitle(title);
          setWorkflowTitle(title);
          setSaveDescription(description);
          
          toast.success(`Workflow "${title}" importé et sauvegardé avec succès`);
          
          // Clean up URL parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('import');
          url.searchParams.delete('title');
          url.searchParams.delete('description');
          window.history.replaceState({}, '', url.toString());
        } else {
          throw new Error('Erreur lors de la sauvegarde du workflow importé');
        }
      } else {
        toast.error('Format de workflow invalide');
      }
    } catch (error) {
      console.error('Erreur lors de l\'importation du workflow:', error);
      toast.error('Erreur lors de l\'importation du workflow');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new workflow creation with title and description
  const handleNewWorkflowCreation = async (title: string, description: string) => {
    setIsLoading(true);
    
    try {
      // Prepare initial workflow data
      const workflowData = {
        nodes: initialNodes,
        edges: [],
        variables: []
      };
      
      // Create workflow in database
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          workflowData,
          isPublic: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la création du workflow');
      }
      
      const newWorkflow = await response.json();
      
      // Set workflow state
      setCurrentWorkflowId(newWorkflow.id);
      setSaveTitle(title);
      setWorkflowTitle(title);
      setSaveDescription(description);
      
      // Reset to initial state with default nodes
      setNodes(initialNodes);
      setEdges([]);
      setVariables([]);
      
      // Reset history with new workflow
      const newState = {
        nodes: JSON.parse(JSON.stringify(initialNodes)),
        edges: [],
        timestamp: Date.now()
      };
      setHistory([newState]);
      setHistoryIndex(0);
      
      toast.success(`Nouveau workflow "${title}" créé et sauvegardé`);
      
      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('title');
      url.searchParams.delete('description');
      window.history.replaceState({}, '', url.toString());
      
    } catch (error) {
      console.error('Erreur lors de la création du workflow:', error);
      toast.error('Erreur lors de la création du workflow');
    } finally {
      setIsLoading(false);
    }
  };

  // Update dots color based on theme
  useEffect(() => {
    const updateDotsColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setDotsColor(isDark ? '#374151' : '#e2e8f0');
    };

    // Initial color
    updateDotsColor();

    // Watch for theme changes
    const observer = new MutationObserver(updateDotsColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Prepare workflow data (shared function for export and save)
  const prepareWorkflowData = useCallback(() => {
    // Force une mise à jour de l'état avant l'export en collectant les valeurs depuis le DOM
    const updatedNodes = nodes.map(node => {
      if (node.type === 'prompt') {
        // Récupérer le contenu actuel depuis le textarea
        const reactFlowNode = document.querySelector(`[data-id="${node.id}"]`);
        const textareaElement = reactFlowNode?.querySelector('textarea');
        if (textareaElement && textareaElement instanceof HTMLTextAreaElement) {
          return {
            ...node,
            data: {
              ...node.data,
              text: textareaElement.value
            }
          };
        }
      }
      return node;
    });

    const workflowData = {
      nodes: updatedNodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: node.data.label,
          text: node.data.text,
          selectedModel: node.data.selectedModel,
          variableName: node.data.variableName,
          systemPrompt: node.data.systemPrompt || '',
          userPrompt: node.data.userPrompt || '',
          result: node.data.result || '',
          selectedFiles: node.data.selectedFiles || [],
          isSearchGroundingEnabled: node.data.isSearchGroundingEnabled || false,
          isMapsGroundingEnabled: node.data.isMapsGroundingEnabled || false,
          isLegalEnabled: node.data.isLegalEnabled || false,
          // Decision node specific fields
          instructions: node.data.instructions || '',
          choices: node.data.choices || [],
          // Note node specific fields
          content: node.data.content || '',
          // Files node specific fields
          askBeforeRun: node.data.askBeforeRun || false,
          description: node.data.description || '',
        }
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      variables: variables,
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        name: 'Workflow Export'
      }
    };

    return workflowData;
  }, [nodes, edges, variables]);

  // Export workflow to JSON
  const exportWorkflow = useCallback(() => {
    const workflowData = prepareWorkflowData();
    const dataStr = JSON.stringify(workflowData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [prepareWorkflowData]);

  // Save workflow to database (create new or update existing)
  const saveWorkflow = useCallback(async () => {
    if (!saveTitle.trim()) {
      toast.error('Veuillez entrer un nom pour le workflow');
      return;
    }

    setIsSaving(true);

    try {
      const workflowData = prepareWorkflowData();
      
      // If we have a currentWorkflowId, it's an update, otherwise it's a new workflow
      const isUpdate = !!currentWorkflowId;
      const url = isUpdate ? `/api/workflows/${currentWorkflowId}` : '/api/workflows';
      const method = isUpdate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: saveTitle.trim(),
          description: saveDescription.trim() || null,
          workflowData: workflowData,
          isPublic: false, // Par défaut privé
        }),
      });

      if (response.ok) {
        const savedWorkflow = await response.json();
        setWorkflowTitle(saveTitle.trim());
        
        if (!isUpdate) {
          // If it's a new workflow, set the ID and update the URL
          setCurrentWorkflowId(savedWorkflow.id);
          window.history.replaceState({}, '', `/workflows?id=${savedWorkflow.id}`);
        }
        
        toast.success(isUpdate ? 'Workflow mis à jour avec succès !' : 'Workflow sauvegardé avec succès !');
        setShowSaveModal(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde du workflow');
    } finally {
      setIsSaving(false);
    }
  }, [saveTitle, saveDescription, prepareWorkflowData, currentWorkflowId]);

  // Open save modal
  const openSaveModal = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  // Auto-save function (silent, no toasts)
  const autoSaveWorkflow = useCallback(async () => {
    // Only auto-save if we have a currentWorkflowId (existing workflow)
    if (!currentWorkflowId) return;

    try {
      const workflowData = prepareWorkflowData();
      
      const response = await fetch(`/api/workflows/${currentWorkflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: workflowTitle || 'Untitled Workflow',
          description: '',
          workflowData: workflowData,
          isPublic: false,
        }),
      });

      if (response.ok) {
        console.log('Workflow auto-saved successfully');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentWorkflowId, workflowTitle, prepareWorkflowData]);

  // Import workflow from JSON
  const importWorkflow = useCallback((file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string);
        
        // Validate the JSON structure
        if (!workflowData.nodes || !workflowData.edges) {
          alert('Format de fichier invalide. Le fichier doit contenir des nœuds et des connexions.');
          return;
        }

        // Restore nodes with proper callback functions
        const importedNodes = workflowData.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            onTextChange: () => {},
            onModelChange: () => {},
            onVariableNameChange: () => {},
            onFilesChange: () => {},
            onDelete: () => {},
          }
        }));

        // Restore edges
        const importedEdges = workflowData.edges.map((edge: any) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        }));

        // Restore variables if they exist
        const importedVariables = workflowData.variables || [];

        setNodes(importedNodes);
        setEdges(importedEdges);
        setVariables(importedVariables);

        // Reset history with imported workflow
        const importedState = {
          nodes: JSON.parse(JSON.stringify(importedNodes)),
          edges: JSON.parse(JSON.stringify(importedEdges)),
          timestamp: Date.now()
        };
        setHistory([importedState]);
        setHistoryIndex(0);

        console.log('Workflow importé avec succès:', workflowData.metadata);
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'import du fichier. Veuillez vérifier le format JSON.');
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges]);

  // Auto-save on page unload and visibility change
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use fetch with keepalive for reliable auto-save on page unload
      if (currentWorkflowId) {
        try {
          const workflowData = prepareWorkflowData();
          
          fetch(`/api/workflows/${currentWorkflowId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: workflowTitle || 'Untitled Workflow',
              description: '',
              workflowData: workflowData,
              isPublic: false,
            }),
            keepalive: true // Ensures request completes even if page unloads
          }).catch(error => {
            console.error('Auto-save on unload failed:', error);
          });
        } catch (error) {
          console.error('Auto-save on unload failed:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        autoSaveWorkflow();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentWorkflowId, workflowTitle, prepareWorkflowData, autoSaveWorkflow]);

  // Auto-save periodically
  useEffect(() => {
    if (!currentWorkflowId) return;

    // Auto-save every 30 seconds
    const interval = setInterval(() => {
      autoSaveWorkflow();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentWorkflowId, autoSaveWorkflow]);

  // Auto-save when nodes or edges change (debounced)
  useEffect(() => {
    if (!currentWorkflowId) return;

    const timeoutId = setTimeout(() => {
      autoSaveWorkflow();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, variables, currentWorkflowId, autoSaveWorkflow]);

  // Sync editingNode with nodes state changes (for real-time updates during execution)
  useEffect(() => {
    if (editingNode && editingNode.id !== 'variables-panel') {
      const currentNode = nodes.find(node => node.id === editingNode.id);
      if (currentNode) {
        setEditingNode(currentNode);
      }
    }
  }, [nodes, editingNode]);

  // Handle connection start to highlight compatible handles
  const onConnectStart: OnConnectStart = useCallback((event, { nodeId, handleId, handleType }) => {
    setConnectingFrom({ nodeId, handleId, handleType });
  }, []);

  // Handle connection end to clear highlighting
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  // Check if a handle should be highlighted based on current connection attempt
  const isHandleHighlighted = useCallback((nodeId: string, handleId: string, handleType: 'source' | 'target') => {
    if (!connectingFrom) return false;
    
    // Empêcher les connexions d'un nœud vers lui-même
    if (connectingFrom.nodeId === nodeId) return false;
    
    const sourceNode = nodes.find(n => n.id === connectingFrom.nodeId);
    const targetNode = nodes.find(n => n.id === nodeId);
    
    if (!sourceNode || !targetNode) return false;
    
    // If we're connecting from a source handle, highlight compatible target handles
    if (connectingFrom.handleType === 'source' && handleType === 'target') {
      // Generate output → Generate input
      if (sourceNode.type === 'generate' && targetNode.type === 'generate' &&
          connectingFrom.handleId === 'output' && handleId === 'input') {
        return true;
      }

      // Generate output → Decision input
      if (sourceNode.type === 'generate' && targetNode.type === 'decision' &&
          connectingFrom.handleId === 'output' && handleId === 'input') {
        return true;
      }

      // Decision output → Generate input
      // Accept any decision output handle (choice-0, choice-1, else, etc.)
      if (sourceNode.type === 'decision' && targetNode.type === 'generate' &&
          handleId === 'input') {
        return true;
      }

      // Decision output → Decision input
      // Accept any decision output handle (choice-0, choice-1, else, etc.)
      if (sourceNode.type === 'decision' && targetNode.type === 'decision' &&
          handleId === 'input') {
        return true;
      }

      // Files → Generate files
      if (sourceNode.type === 'files' && targetNode.type === 'generate' &&
          connectingFrom.handleId === 'files' && handleId === 'files') {
        return true;
      }

      // Files → Decision files
      if (sourceNode.type === 'files' && targetNode.type === 'decision' &&
          connectingFrom.handleId === 'files' && handleId === 'files') {
        return true;
      }
    }

    return false;
  }, [connectingFrom, nodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      // Clear highlighting
      setConnectingFrom(null);
      
      let newEdges = edges;
      
      // Identifier les types de connexions
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Cas 1: Generate → Generate (chaînage via input)
      if (sourceNode.type === 'generate' && targetNode.type === 'generate' &&
          params.sourceHandle === 'output' && params.targetHandle === 'input') {
        // Supprimer toute connexion existante vers le même handle du même nœud Generate
        const edgesWithoutTargetConnection = edges.filter(edge =>
          !(edge.target === params.target && edge.targetHandle === params.targetHandle)
        );
        const newEdge = {
          ...params,
          className: 'generate-to-generate',
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edgesWithoutTargetConnection);
      }
      // Cas 2: Generate → Decision (chaînage via input - permet connexions multiples)
      else if (sourceNode.type === 'generate' && targetNode.type === 'decision' &&
               params.sourceHandle === 'output' && params.targetHandle === 'input') {
        // Permettre plusieurs connexions vers le handle input du Decision node
        const newEdge = {
          ...params,
          className: 'generate-to-generate',
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edges);
      }
      // Cas 3: Decision → Generate (chaînage via n'importe quelle sortie)
      else if (sourceNode.type === 'decision' && targetNode.type === 'generate' &&
               params.targetHandle === 'input') {
        // Supprimer toute connexion existante vers le même handle du même nœud Generate
        const edgesWithoutTargetConnection = edges.filter(edge =>
          !(edge.target === params.target && edge.targetHandle === params.targetHandle)
        );
        const newEdge = {
          ...params,
          className: 'generate-to-generate',
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edgesWithoutTargetConnection);
      }
      // Cas 4: Decision → Decision (chaînage via n'importe quelle sortie - permet connexions multiples)
      else if (sourceNode.type === 'decision' && targetNode.type === 'decision' &&
               params.targetHandle === 'input') {
        // Permettre plusieurs connexions vers le handle input du Decision node
        const newEdge = {
          ...params,
          className: 'generate-to-generate',
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edges);
      }
      // Cas 5: Files → Generate (connexions de fichiers)
      else if (sourceNode.type === 'files' && targetNode.type === 'generate' &&
               params.sourceHandle === 'files' && params.targetHandle === 'files') {
        // Permettre plusieurs connexions de Files vers le même handle Generate
        // Ne pas supprimer les connexions existantes, juste ajouter la nouvelle
        const newEdge = {
          ...params,
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edges);
      }
      // Cas 6: Files → Decision (connexions de fichiers)
      else if (sourceNode.type === 'files' && targetNode.type === 'decision' &&
               params.sourceHandle === 'files' && params.targetHandle === 'files') {
        // Permettre plusieurs connexions de Files vers le handle files du Decision
        const newEdge = {
          ...params,
          data: {
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
        newEdges = addEdge(newEdge, edges);
      }

      if (newEdges !== edges) {
        setEdges(newEdges);
        saveToHistory(nodes, newEdges);
      }
    },
    [setEdges, nodes, edges, saveToHistory]
  );

  // Fonction pour valider les connexions
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;

    // Empêcher les connexions d'un nœud vers lui-même
    if (connection.source === connection.target) {
      return false;
    }

    // Generate → Generate (chaînage via input)
    if (sourceNode.type === 'generate' && targetNode.type === 'generate' &&
        connection.sourceHandle === 'output' && connection.targetHandle === 'input') {
      return true;
    }

    // Generate → Decision (chaînage via input)
    if (sourceNode.type === 'generate' && targetNode.type === 'decision' &&
        connection.sourceHandle === 'output' && connection.targetHandle === 'input') {
      return true;
    }

    // Decision → Generate (via n'importe quelle sortie decision)
    if (sourceNode.type === 'decision' && targetNode.type === 'generate' &&
        connection.targetHandle === 'input') {
      return true;
    }

    // Decision → Decision (via n'importe quelle sortie decision)
    if (sourceNode.type === 'decision' && targetNode.type === 'decision' &&
        connection.targetHandle === 'input') {
      return true;
    }

    // Files → Generate (files)
    if (sourceNode.type === 'files' && targetNode.type === 'generate' &&
        connection.sourceHandle === 'files' && connection.targetHandle === 'files') {
      return true;
    }

    // Files → Decision (files)
    if (sourceNode.type === 'files' && targetNode.type === 'decision' &&
        connection.sourceHandle === 'files' && connection.targetHandle === 'files') {
      return true;
    }

    return false;
  }, [nodes]);

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      setEdges((eds) => eds.filter(edge => 
        !edgesToDelete.find(deletedEdge => deletedEdge.id === edge.id)
      ));
      setSelectedEdge(null);
    },
    [setEdges]
  );

  // Delete specific edge by ID
  const deleteEdge = useCallback((edgeId: string) => {
    const newEdges = edges.filter(edge => edge.id !== edgeId);
    setEdges(newEdges);
    setSelectedEdge(null);
    saveToHistory(nodes, newEdges);
  }, [setEdges, edges, nodes, saveToHistory]);

  // Handle edge click for selection
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge.id);
  }, []);


  // Handle background click to deselect edge and close edit panel
  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setIsEditPanelOpen(false);
    setEditingNode(null);
  }, []);

  // Handle node selection for edit panel
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    event.stopPropagation();

    // Don't open edit panel for note nodes
    if (node.type === 'note') {
      return;
    }

    setEditingNode(node);
    setIsEditPanelOpen(true);
    setShowResults(false); // Reset to edit view when switching nodes
  }, []);

  // Add execution log
  const addExecutionLog = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string, nodeId?: string, nodeName?: string) => {
    const log = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      nodeId,
      nodeName,
      message
    };
    setExecutionLogs(prev => [...prev, log]);
  }, []);

  // Get selected node
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;


  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    const newNodes = nodes.filter(node => node.id !== nodeId);
    const newEdges = edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    saveToHistory(newNodes, newEdges);
  }, [setNodes, setEdges, nodes, edges, saveToHistory]);

  // Function to validate and ensure unique variable names
  const validateVariableName = useCallback((newName: string, currentNodeId: string) => {
    if (!newName.trim()) {
      toast.error('Le nom de variable ne peut pas être vide');
      return false;
    }

    // Check if name already exists in other Generate nodes
    const existingNames = nodes
      .filter(node => node.type === 'generate' && node.id !== currentNodeId)
      .map(node => node.data.variableName);

    if (existingNames.includes(newName.trim())) {
      toast.error('Ce nom de variable existe déjà. Choisissez un nom unique.');
      return false;
    }

    return true;
  }, [nodes]);


  const addGenerateNode = useCallback(() => {
    // Generate a unique variable name based on existing Generate nodes
    const generateNodes = nodes.filter(node => node.type === 'generate');
    
    // Find the next available number for AI Agent
    let nextNumber = 1;
    const existingNames = generateNodes.map(node => node.data.variableName);
    
    while (existingNames.includes(`AI Agent ${nextNumber}`)) {
      nextNumber++;
    }
    
    const newNode = {
      id: `generate-${Date.now()}`,
      type: 'generate',
      position: { x: Math.random() * 300 + 400, y: Math.random() * 300 },
      data: {
        label: 'Generate Text',
        selectedModel: 'chat-model-medium',
        result: '',
        variableName: `AI Agent ${nextNumber}`,
        systemPrompt: '',
        userPrompt: '',
        isSearchGroundingEnabled: false,
        isMapsGroundingEnabled: false,
        isLegalEnabled: false,
        onModelChange: () => {},
        onVariableNameChange: () => {},
        onSystemPromptChange: () => {},
        onUserPromptChange: () => {},
        onDelete: () => {},
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [setNodes, nodes, edges, saveToHistory]);

  const addFilesNode = useCallback(() => {
    // Generate a unique variable name based on existing Files nodes
    const filesNodes = nodes.filter(node => node.type === 'files');

    // Find the next available number for Files
    let nextNumber = 1;
    const existingNames = filesNodes.map(node => node.data.variableName);

    while (existingNames.includes(`Files ${nextNumber}`)) {
      nextNumber++;
    }

    const newNode = {
      id: `files-${Date.now()}`,
      type: 'files',
      position: { x: Math.random() * 300, y: Math.random() * 300 + 200 },
      data: {
        label: 'Files',
        variableName: `Files ${nextNumber}`,
        selectedFiles: [],
        onFilesChange: () => {},
        onDelete: () => {},
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [setNodes, nodes, edges, saveToHistory]);

  const addNoteNode = useCallback(() => {
    const newNode = {
      id: `note-${Date.now()}`,
      type: 'note',
      position: { x: Math.random() * 300 + 200, y: Math.random() * 300 + 100 },
      data: {
        label: 'Note',
        content: '',
        onContentChange: () => {},
        onDelete: () => {},
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [setNodes, nodes, edges, saveToHistory]);

  const addDecisionNode = useCallback(() => {
    // Generate a unique variable name based on existing Decision nodes
    const decisionNodes = nodes.filter(node => node.type === 'decision');

    // Find the next available number for Decision Node
    let nextNumber = 1;
    const existingNames = decisionNodes.map(node => node.data.variableName);

    while (existingNames.includes(`Decision ${nextNumber}`)) {
      nextNumber++;
    }

    const newNode = {
      id: `decision-${Date.now()}`,
      type: 'decision',
      position: { x: Math.random() * 300 + 400, y: Math.random() * 300 },
      data: {
        label: 'Decision',
        selectedModel: 'chat-model-medium', // Fixed to medium model
        result: '',
        variableName: `Decision ${nextNumber}`,
        instructions: '', // User prompt renamed to instructions
        choices: ['True', 'False'], // Default choices
        selectedChoice: undefined,
        onModelChange: () => {},
        onVariableNameChange: () => {},
        onInstructionsChange: () => {},
        onChoicesChange: () => {},
        onDelete: () => {},
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  }, [setNodes, nodes, edges, saveToHistory]);

  // Function that actually executes the workflow
  const executeWorkflow = useCallback(async (variablesToUse?: Variable[]) => {
    // Prevent double execution
    if (isExecutingRef.current) {
      console.log('Workflow execution already in progress, skipping...');
      return;
    }

    // Set execution flag
    isExecutingRef.current = true;

    // Use provided variables or fall back to state variables
    const currentVariables = variablesToUse || variables;

    // Update the ref so processPromptText uses the latest values (including predefined variables)
    currentVariablesRef.current = [...predefinedVariables, ...currentVariables];
    console.log('[executeWorkflow] Using variables:', currentVariablesRef.current);

    // Validate that all AI Generators and Decision Nodes have prompts/instructions
    const generateNodes = nodes.filter(node => node.type === 'generate');
    const decisionNodes = nodes.filter(node => node.type === 'decision');

    const nodesWithoutUserPrompt = generateNodes.filter(node =>
      !node.data.userPrompt || node.data.userPrompt.trim() === ''
    );

    const nodesWithoutInstructions = decisionNodes.filter(node =>
      !node.data.instructions || node.data.instructions.trim() === ''
    );

    if (nodesWithoutUserPrompt.length > 0 || nodesWithoutInstructions.length > 0) {
      const allInvalidNodes = [
        ...nodesWithoutUserPrompt.map(node => node.data.variableName || node.data.label || 'Unnamed AI Agent'),
        ...nodesWithoutInstructions.map(node => node.data.variableName || node.data.label || 'Unnamed Decision Node')
      ];
      const nodeNames = allInvalidNodes.join(', ');

      showNotification(`Cannot run workflow: The following node(s) are missing prompts/instructions: ${nodeNames}`, 'error');
      isExecutingRef.current = false;
      return;
    }

    // Validate that all variables used in prompts exist
    const nodesWithInvalidVariables: Array<{node: any, invalidVars: string[]}> = [];

    generateNodes.forEach(node => {
      const allInvalidVars: string[] = [];

      // Check system prompt variables
      const systemValidation = invalidVariables[`${node.id}-system`];
      if (systemValidation?.hasInvalid) {
        allInvalidVars.push(...systemValidation.variables);
      }

      // Check user prompt variables
      const userValidation = invalidVariables[`${node.id}-user`];
      if (userValidation?.hasInvalid) {
        allInvalidVars.push(...userValidation.variables);
      }

      if (allInvalidVars.length > 0) {
        nodesWithInvalidVariables.push({
          node,
          invalidVars: [...new Set(allInvalidVars)] // Remove duplicates
        });
      }
    });

    // Validate decision nodes
    decisionNodes.forEach(node => {
      const allInvalidVars: string[] = [];

      // Check instructions variables
      const instructionsValidation = invalidVariables[`${node.id}-instructions`];
      if (instructionsValidation?.hasInvalid) {
        allInvalidVars.push(...instructionsValidation.variables);
      }

      if (allInvalidVars.length > 0) {
        nodesWithInvalidVariables.push({
          node,
          invalidVars: [...new Set(allInvalidVars)]
        });
      }
    });

    if (nodesWithInvalidVariables.length > 0) {
      const invalidVarsList = nodesWithInvalidVariables.map(({ node, invalidVars }) => {
        const nodeName = node.data.variableName || node.data.label || 'Unnamed AI Agent';
        return `${nodeName}: {{${invalidVars.join('}}, {{')}}}`;
      }).join('; ');

      showNotification(`Cannot run workflow: The following variables are not defined: ${invalidVarsList}`, 'error');
      isExecutingRef.current = false;
      return;
    }

    setIsRunning(true);
    
    // Open console to show results
    setIsConsoleOpen(true);
    
    // Clear previous logs
    setExecutionLogs([]);
    
    // Add initial log
    addExecutionLog('info', 'Workflow execution started...');
    
    try {
      // First, clear all previous results from Generate and Decision nodes before starting
      [...generateNodes, ...decisionNodes].forEach(node => {
        updateNodeData(node.id, { result: '', isLoading: false, executionState: 'idle', selectedChoice: undefined });
      });

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create initial execution order (only root nodes without incoming edges)
      const rootNodes = nodes.filter(node => {
        const hasIncomingEdge = edges.some(edge => edge.target === node.id);
        return !hasIncomingEdge && (node.type === 'generate' || node.type === 'decision' || node.type === 'files');
      });

      console.log('[executeWorkflow] Root nodes:', rootNodes.map(n => n.id));

      // Process nodes recursively starting from root nodes
      const processedNodes = new Set<string>();

      const processNodeAndDescendants = async (nodeId: string) => {
        const currentNodeState = await new Promise<any>(resolve => {
          setNodes(currentNodes => {
            const node = currentNodes.find(n => n.id === nodeId);
            resolve(node);
            return currentNodes;
          });
        });

        if (!currentNodeState) {
          return;
        }

        // For Decision nodes, check if ALL input nodes have completed BEFORE checking processedNodes
        if (currentNodeState.type === 'decision') {
          const inputEdges = edges.filter(edge => edge.target === nodeId && edge.targetHandle === 'input');
          console.log(`[processNodeAndDescendants] Decision node ${nodeId} has ${inputEdges.length} input edges`);

          // Check if all connected input nodes are completed
          let allInputsReady = true;
          for (const inputEdge of inputEdges) {
            const inputNode = await new Promise<any>(resolve => {
              setNodes(currentNodes => {
                const node = currentNodes.find(n => n.id === inputEdge.source);
                resolve(node);
                return currentNodes;
              });
            });

            if (!inputNode || inputNode.data.executionState !== 'completed') {
              console.log(`[processNodeAndDescendants] Decision node ${nodeId} waiting for input node ${inputEdge.source} to complete`);
              allInputsReady = false;
              break;
            }
          }

          if (!allInputsReady) {
            console.log(`[processNodeAndDescendants] Decision node ${nodeId} not ready, skipping for now (NOT marking as processed)`);
            return; // Skip this node for now, DON'T add to processedNodes so it can be retried
          }

          console.log(`[processNodeAndDescendants] All inputs ready for Decision node ${nodeId}, executing...`);
        }

        // Avoid processing the same node twice (check AFTER decision readiness check)
        if (processedNodes.has(nodeId)) {
          console.log(`[processNodeAndDescendants] Node ${nodeId} already processed, skipping`);
          return;
        }
        processedNodes.add(nodeId);

        // Files nodes don't need execution, they just pass through
        if (currentNodeState.type === 'files') {
          console.log(`[processNodeAndDescendants] Files node ${nodeId}, passing through...`);
          // Continue to descendants without executing
        } else if (currentNodeState.type === 'generate' || currentNodeState.type === 'decision') {
          // Execute the current node (AI Agent or Decision)
          await processGenerateNodeInOrder(nodeId);
        } else {
          // Unknown node type, skip
          return;
        }

        // Get the updated node state after execution to check for selectedChoice
        const updatedNodeState = await new Promise<any>(resolve => {
          setNodes(currentNodes => {
            const node = currentNodes.find(n => n.id === nodeId);
            resolve(node);
            return currentNodes;
          });
        });

        // Find all outgoing edges from this node
        const outgoingEdges = edges.filter(edge => edge.source === nodeId);

        // If this is a decision node, only follow the edge matching the selected choice
        if (updatedNodeState?.type === 'decision' && updatedNodeState.data?.selectedChoice) {
          const selectedChoice = updatedNodeState.data.selectedChoice;
          console.log(`[executeWorkflow] Decision node ${nodeId} selected: ${selectedChoice}`);

          // Find the edge that matches the selected choice
          let matchingEdge;
          if (selectedChoice === 'else') {
            matchingEdge = outgoingEdges.find(edge => edge.sourceHandle === 'else');
          } else {
            // Find the index of the selected choice
            const choices = updatedNodeState.data.choices || [];
            const choiceIndex = choices.findIndex((c: string) => c === selectedChoice);
            if (choiceIndex !== -1) {
              matchingEdge = outgoingEdges.find(edge => edge.sourceHandle === `choice-${choiceIndex}`);
            }
          }

          if (matchingEdge) {
            console.log(`[executeWorkflow] Following edge to ${matchingEdge.target} (choice: ${selectedChoice})`);
            await processNodeAndDescendants(matchingEdge.target);
          } else {
            console.log(`[executeWorkflow] No matching edge found for choice: ${selectedChoice}`);
          }
        } else if (updatedNodeState?.type === 'files') {
          // For files nodes, follow all outgoing edges (they connect via 'files' handle)
          console.log(`[processNodeAndDescendants] Files node has ${outgoingEdges.length} outgoing edges`);
          for (const edge of outgoingEdges) {
            await processNodeAndDescendants(edge.target);
          }
        } else {
          // For generate nodes or nodes without choices, follow all outgoing edges
          for (const edge of outgoingEdges) {
            // Only follow edges from 'output' handle for generate nodes
            if (updatedNodeState?.type === 'generate' && edge.sourceHandle === 'output') {
              // Check if target is a decision node that might have been skipped earlier
              const targetNode = await new Promise<any>(resolve => {
                setNodes(currentNodes => {
                  const node = currentNodes.find(n => n.id === edge.target);
                  resolve(node);
                  return currentNodes;
                });
              });

              // Always try to process descendants (decision nodes will check if they're ready)
              await processNodeAndDescendants(edge.target);
            }
          }
        }
      };

      // Process all root nodes
      for (const rootNode of rootNodes) {
        await processNodeAndDescendants(rootNode.id);
      }
      
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
      // Reset execution flag
      isExecutingRef.current = false;
      // Clear processing nodes set
      processingNodesRef.current.clear();
      console.log('[executeWorkflow] Cleared processing nodes set');
    }
  }, [nodes, updateNodeData, setNodes, invalidVariables, showNotification]);

  // Handler for Run button - checks if we need to show pre-run modal
  const handleRun = useCallback(() => {
    // Check if there are any variables that need to be asked before run
    const variablesToAsk = variables.filter(v => v.askBeforeRun);

    // Check if there are any files nodes that need to be asked before run
    const filesNodesToAsk = nodes.filter(node =>
      node.type === 'files' && node.data.askBeforeRun
    );

    if (variablesToAsk.length > 0 || filesNodesToAsk.length > 0) {
      // Show the pre-run modal
      setShowPreRunModal(true);
    } else {
      // Execute directly
      executeWorkflow();
    }
  }, [variables, nodes, executeWorkflow]);

  // Handler for pre-run modal confirmation
  const handlePreRunConfirm = useCallback((
    updatedVariables: Variable[],
    updatedFilesNodes?: Map<string, Array<{ url: string; name: string; contentType: string }>>
  ) => {
    // Update variables with the new values from the modal
    setVariables(updatedVariables);

    // Update files nodes with selected files
    if (updatedFilesNodes) {
      const updatedNodes = nodes.map(node => {
        if (node.type === 'files' && updatedFilesNodes.has(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              selectedFiles: updatedFilesNodes.get(node.id) || []
            }
          };
        }
        return node;
      });
      setNodes(updatedNodes);
    }

    // Close modal
    setShowPreRunModal(false);
    // Execute workflow immediately with the updated variables (no need to wait)
    executeWorkflow(updatedVariables);
  }, [executeWorkflow, nodes, setNodes]);
  
  // Helper function to extract clean text from result (handles both string and JSON objects)
  const extractTextFromResult = (result: any): string => {
    if (typeof result === 'string') {
      // If it's already a string, try to parse it as JSON to see if it contains more data
      try {
        const parsed = JSON.parse(result);
        // If it parsed successfully and has userPrompt, it's probably the JSON object bug
        if (parsed && typeof parsed === 'object' && parsed.userPrompt) {
          // Extract just the main response text part (everything before the JSON)
          const lines = result.split('\n');
          const nonJsonLines = [];
          for (const line of lines) {
            // Stop when we hit JSON-like content
            if (line.trim().startsWith('{"') || line.trim().startsWith('"')) {
              break;
            }
            nonJsonLines.push(line);
          }
          return nonJsonLines.join('\n').trim();
        }
        return result; // It's just a JSON string, return as is
      } catch {
        // Not JSON, return the string as is
        return result;
      }
    } else if (result && typeof result === 'object') {
      // If it's an object, try to find a text property
      return result.text || result.content || result.message || result.userPrompt || String(result);
    }
    return String(result || '');
  };

  // Check where a variable is used in the workflow
  const findVariableUsage = (variableName: string): Array<{ id: string; label: string; type: string }> => {
    const usedInNodes: Array<{ id: string; label: string; type: string }> = [];
    const variablePattern = new RegExp(`\\{\\{\\s*${variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');

    nodes.forEach((node) => {
      let isUsed = false;

      // Get the best label for the node - prioritize variableName for all node types
      let nodeLabel = node.data?.variableName;

      // If no variableName, use type-specific defaults
      if (!nodeLabel) {
        if (node.type === 'generate') {
          nodeLabel = 'Generate Node';
        } else if (node.type === 'files') {
          nodeLabel = 'Files Node';
        } else if (node.type === 'note') {
          nodeLabel = node.data?.content?.substring(0, 30) || 'Note Node';
        } else if (node.type === 'decision') {
          nodeLabel = 'Decision Node';
        } else {
          nodeLabel = node.data?.label || node.id;
        }
      }

      const nodeType = node.type || 'unknown';

      // Check in different node properties where variables might be used
      if (node.data?.userPrompt && variablePattern.test(node.data.userPrompt)) {
        isUsed = true;
      }
      if (node.data?.systemPrompt && variablePattern.test(node.data.systemPrompt)) {
        isUsed = true;
      }
      if (node.data?.prompt && variablePattern.test(node.data.prompt)) {
        isUsed = true;
      }
      if (node.data?.content && variablePattern.test(node.data.content)) {
        isUsed = true;
      }

      if (isUsed) {
        usedInNodes.push({ id: node.id, label: nodeLabel, type: nodeType });
      }
    });

    return usedInNodes;
  };

  // Handle delete variable button click
  const handleDeleteVariable = (variableId: string, variableName: string) => {
    const usedInNodes = findVariableUsage(variableName);

    if (usedInNodes.length > 0) {
      // Variable is used, show confirmation modal
      setDeleteVariableConfirmation({
        variableId,
        variableName,
        usedInNodes,
      });
    } else {
      // Variable is not used, delete directly
      setVariables(variables.filter(v => v.id !== variableId));
      toast.success(`Variable "${variableName}" supprimée`);
    }
  };

  // Helper function to process prompt text with variables
  const processPromptText = (text: string, latestNodes: any[]) => {
    let processedText = text;

    // Replace global variables (double braces) - use ref to get latest values
    const currentVars = currentVariablesRef.current;
    console.log('[processPromptText] Using variables from ref:', currentVars);
    currentVars.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      processedText = processedText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), variable.value);
    });
    
    // Replace connected Generate results
    const connectedGenerateEdges = edges.filter(edge => edge.targetHandle === 'input');
    connectedGenerateEdges.forEach(edge => {
      const connectedGenerateNode = latestNodes.find(node => node.id === edge.source && node.type === 'generate');
      if (connectedGenerateNode?.data.result && 
          connectedGenerateNode.data.result.trim() !== '' && 
          connectedGenerateNode.data.result !== 'Generating...' &&
          !(connectedGenerateNode.data as any).isLoading) {
        const variableName = connectedGenerateNode.data.variableName || 'AI Agent 1';
        const placeholder = `{{${variableName}}}`;
        const cleanResult = extractTextFromResult(connectedGenerateNode.data.result);
        processedText = processedText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), cleanResult);
      }
    });
    
    return processedText;
  };
  
  const processGenerateNodeInOrder = async (generateNodeId: string) => {
    // Check if already processing using ref (synchronous check)
    if (processingNodesRef.current.has(generateNodeId)) {
      console.log(`[processGenerateNodeInOrder] Node ${generateNodeId} is already being processed, skipping...`);
      return;
    }

    // Mark as processing immediately
    processingNodesRef.current.add(generateNodeId);
    console.log(`[processGenerateNodeInOrder] Added node ${generateNodeId} to processing set`);

    try {
      // Get node data synchronously first
      let generateNode: any = null;
      let inputEdge: any = null;
      let filesEdges: any[] = [];
      let currentNodes: any[] = [];

      await new Promise<void>((resolveSetNodes) => {
        setNodes(nodes => {
          currentNodes = nodes;
          generateNode = nodes.find(n => n.id === generateNodeId);
          if (generateNode) {
            inputEdge = edges.find(edge => edge.target === generateNodeId && edge.targetHandle === 'input');
            filesEdges = edges.filter(edge => edge.target === generateNodeId && edge.targetHandle === 'files');
          }
          resolveSetNodes();
          return nodes;
        });
      });

      if (!generateNode) {
        console.log(`[processGenerateNodeInOrder] Node ${generateNodeId} not found`);
        return;
      }

      // Process the node
      await processGenerateNode(generateNode, currentNodes, inputEdge, filesEdges);

    } catch (error) {
      console.error(`[processGenerateNodeInOrder] Error processing node ${generateNodeId}:`, error);
      throw error;
    } finally {
      // Remove from processing set
      processingNodesRef.current.delete(generateNodeId);
      console.log(`[processGenerateNodeInOrder] Removed node ${generateNodeId} from processing set`);
    }
  };
  
  const processGenerateNode = async (generateNode: any, currentNodes: any[], inputEdge?: any, filesEdges?: any[]) => {
    try {
      const nodeName = generateNode.data.variableName || generateNode.data.label || 'AI Agent';

      console.log(`[processGenerateNode] Called for node ${generateNode.id} (${nodeName})`);

      // Check if node is in processing set - CRITICAL CHECK
      if (!processingNodesRef.current.has(generateNode.id)) {
        console.log(`[processGenerateNode] Node ${generateNode.id} is NOT in processing set, aborting (likely duplicate call)`);
        return;
      }

      // Log start of processing
      addExecutionLog('info', `Starting generation...`, generateNode.id, nodeName);

      // Set processing state (orange)
      updateNodeData(generateNode.id, { result: 'Generating...', isLoading: true, executionState: 'processing' });

      // Get the latest node state to ensure fresh data
      const latestNodes = await new Promise<any[]>(resolve => {
        setNodes(current => {
          resolve(current);
          return current;
        });
      });

      // Get the current node data
      const currentGenerateNode = latestNodes.find(node => node.id === generateNode.id);
      let systemPrompt = '';
      let userPrompt = '';

      // Handle Decision Nodes vs Generate Nodes
      if (currentGenerateNode?.type === 'decision') {
        // For decision nodes, create automatic system prompt with choices
        const choices = currentGenerateNode?.data?.choices || [];
        const choicesList = choices.map((choice: string) => `"${choice}"`).join(', ');

        // Collect context from connected input nodes (both Generate and Decision nodes)
        let connectedContext = '';
        const inputEdges = edges.filter(edge => edge.target === generateNode.id && edge.targetHandle === 'input');

        inputEdges.forEach(edge => {
          const connectedNode = latestNodes.find(node => node.id === edge.source);
          // Support both 'generate' and 'decision' node types
          if ((connectedNode?.type === 'generate' || connectedNode?.type === 'decision') &&
              connectedNode.data.result &&
              connectedNode.data.result.trim() !== '' &&
              connectedNode.data.result !== 'Generating...' &&
              !(connectedNode.data as any).isLoading) {
            const variableName = connectedNode.data.variableName ||
                               (connectedNode.type === 'decision' ? 'Decision Node' : 'AI Agent');
            const cleanResult = extractTextFromResult(connectedNode.data.result);
            connectedContext += `\nRéponse de l'Agent ${variableName} :\n${cleanResult}\n`;
          }
        });

        systemPrompt = `You are a decision-making assistant. You will be asked a question and you must respond with ONLY ONE of these exact choices: ${choicesList}${choices.length > 0 ? ', ' : ''}or "Else".
${connectedContext ? `\nCONTEXT FROM CONNECTED NODES:${connectedContext}` : ''}
IMPORTANT: Your response must be EXACTLY one of the choices listed above. Do not add any explanation, context, or additional text. Just respond with the choice that best matches the situation.`;

        userPrompt = processPromptText(currentGenerateNode?.data?.instructions || '', latestNodes);
      } else {
        // For generate nodes, use normal prompts
        systemPrompt = currentGenerateNode?.data?.systemPrompt || '';
        userPrompt = currentGenerateNode?.data?.userPrompt || '';

        // Process variables in the prompts
        systemPrompt = processPromptText(systemPrompt, latestNodes);
        userPrompt = processPromptText(userPrompt, latestNodes);
      }

      // The input connection is only used for variable validation and replacement
      // Variables are already processed in processPromptText() above
      // No automatic injection of connected results

      // Process files from connected Files nodes
      let allFiles: any[] = [];
      if (filesEdges && filesEdges.length > 0) {
        filesEdges.forEach(edge => {
          const filesNode = latestNodes.find(node => node.id === edge.source);
          if (filesNode && filesNode.type === 'files' && filesNode.data.selectedFiles) {
            // Ajouter tous les fichiers de ce nœud Files, en évitant les doublons
            const newFiles = filesNode.data.selectedFiles.filter((newFile: any) =>
              !allFiles.some(existingFile => existingFile.url === newFile.url)
            );
            allFiles = [...allFiles, ...newFiles];
          }
        });
      }

      console.log(`[processGenerateNode] Making API call for node ${generateNode.id}`);

      // Call the AI API with system and user prompts and files
      const response = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt: systemPrompt,
          userPrompt: userPrompt,
          model: generateNode.data.selectedModel,
          files: allFiles.length > 0 ? allFiles : undefined,
          isSearchGroundingEnabled: generateNode.data.isSearchGroundingEnabled || false,
          isMapsGroundingEnabled: generateNode.data.isMapsGroundingEnabled || false,
          isLegalEnabled: generateNode.data.isLegalEnabled || false,
        }),
      });
      
      if (response.ok) {
        const result = await response.text();

        // For decision nodes, parse the response to determine the selected choice
        if (currentGenerateNode?.type === 'decision') {
          const choices = currentGenerateNode?.data?.choices || [];
          const resultTrimmed = result.trim();

          // Try to match the response with one of the choices
          let selectedChoice: string | undefined;

          // First, try exact match (case-insensitive)
          const exactMatch = choices.find((choice: string) =>
            choice.toLowerCase() === resultTrimmed.toLowerCase()
          );

          if (exactMatch) {
            selectedChoice = exactMatch;
          } else if (resultTrimmed.toLowerCase() === 'else') {
            selectedChoice = 'else';
          } else {
            // If no exact match, try to find the choice in the response
            const partialMatch = choices.find((choice: string) =>
              resultTrimmed.toLowerCase().includes(choice.toLowerCase())
            );

            if (partialMatch) {
              selectedChoice = partialMatch;
            } else {
              // Default to 'else' if no match found
              selectedChoice = 'else';
            }
          }

          // Set completed state with selected choice
          updateNodeData(generateNode.id, {
            result,
            selectedChoice,
            isLoading: false,
            executionState: 'completed'
          });

          // Log success
          addExecutionLog('success', `Decision made: ${selectedChoice}`, generateNode.id, nodeName);
        } else {
          // For generate nodes, just set the result
          updateNodeData(generateNode.id, { result, isLoading: false, executionState: 'completed' });

          // Log success
          addExecutionLog('success', `Generation completed successfully`, generateNode.id, nodeName);
        }
      } else {
        const errorMsg = 'Error: Failed to generate content';
        updateNodeData(generateNode.id, { 
          result: errorMsg, 
          isLoading: false,
          executionState: 'error'
        });
        
        // Log error
        addExecutionLog('error', `Generation failed: ${response.status} ${response.statusText}`, generateNode.id, nodeName);
      }
    } catch (error) {
      console.error('Error processing generate node:', error);
      const errorMsg = 'Error: Failed to generate content';
      updateNodeData(generateNode.id, { 
        result: errorMsg, 
        isLoading: false,
        executionState: 'error'
      });
      
      // Log error
      addExecutionLog('error', `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, generateNode.id, nodeName);
    }
  };

  // Function to add appropriate CSS classes to edges based on node types and execution state
  const processEdgesWithClasses = useCallback((edgesToProcess: any[]) => {
    return edgesToProcess.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      let className = '';
      
      // Add animation class for Generate/Decision to Generate/Decision connections
      if ((sourceNode?.type === 'generate' || sourceNode?.type === 'decision') &&
          (targetNode?.type === 'generate' || targetNode?.type === 'decision') &&
          edge.targetHandle === 'input') {
        className = 'generate-to-generate';
      }

      // Add execution state classes
      if (isRunning) {
        // For AI Generator/Decision to AI Generator/Decision connections - only activate when source is completed
        if ((sourceNode?.type === 'generate' || sourceNode?.type === 'decision') &&
            (targetNode?.type === 'generate' || targetNode?.type === 'decision') &&
            sourceNode?.data?.executionState) {
          switch (sourceNode.data.executionState) {
            case 'completed':
              // Only activate the connection and target when source is completed
              if (targetNode.data?.executionState === 'processing' || 
                  targetNode.data?.executionState === 'preparing' || 
                  targetNode.data?.executionState === 'completing') {
                className += ' execution-active';
              } else if (targetNode.data?.executionState === 'completed') {
                className += ' execution-completed';
              } else if (targetNode.data?.executionState === 'error') {
                className += ' execution-error';
              }
              break;
            case 'error':
              className += ' execution-error';
              break;
          }
        }
        // For Files to AI Generator connections - activate when target AI Generator is executing (solid, no animation)
        else if (sourceNode?.type === 'files' && targetNode?.data?.executionState) {
          switch (targetNode.data.executionState) {
            case 'processing':
            case 'preparing':
            case 'completing':
              className += ' execution-active-files';
              break;
            case 'completed':
              className += ' execution-completed-files';
              break;
            case 'error':
              className += ' execution-error-files';
              break;
          }
        }
      }
      
      return {
        ...edge,
        type: 'custom',
        className: className.trim(),
        selected: edge.id === selectedEdge,
        data: {
          ...edge.data,
          sourceType: sourceNode?.type,
          targetType: targetNode?.type,
          onDelete: deleteEdge,
          isSelected: edge.id === selectedEdge
        }
      };
    });
  }, [nodes, isRunning, selectedEdge, deleteEdge]);

  // Update edges with proper classes whenever nodes change (but not processEdgesWithClasses to avoid loops)
  useEffect(() => {
    setEdges(currentEdges => processEdgesWithClasses(currentEdges));
  }, [nodes, isRunning, selectedEdge]); // Only depend on the actual data, not the function

  // Update nodes with callback functions and variables
  const nodesWithCallbacks = useMemo(() => nodes.map(node => {
    const connectedResults = {};
    
    if (node.type === 'generate' || node.type === 'decision') {
      // Function to recursively find all Generate/Decision nodes in the dependency chain
      const findAllAINodesInChain = (nodeId: string, visited = new Set()): any[] => {
        if (visited.has(nodeId)) return []; // Avoid infinite loops
        visited.add(nodeId);

        const aiNodes: any[] = [];

        // Find all nodes that feed into this node
        const incomingEdges = edges.filter(edge => edge.target === nodeId);
        incomingEdges.forEach(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          if (sourceNode) {
            if (sourceNode.type === 'generate' || sourceNode.type === 'decision') {
              // Add this AI node
              aiNodes.push(sourceNode);
            }
            // Recursively check the source node's dependencies
            aiNodes.push(...findAllAINodesInChain(sourceNode.id, visited));
          }
        });

        return aiNodes;
      };

      // Find all AI nodes in the dependency chain
      const allAINodes = findAllAINodesInChain(node.id);

      // Remove duplicates based on node ID
      const uniqueAINodes = allAINodes.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
      );

      // Add all unique AI nodes to connectedResults
      uniqueAINodes.forEach(aiNode => {
        const variableName = aiNode.data.variableName || (aiNode.type === 'decision' ? 'Decision 1' : 'AI Agent 1');
        (connectedResults as any)[variableName] = aiNode.data.result || '';
      });
    }

    // Check if this Files node is connected to an executing AI Generator or Decision Node
    let isConnectedToExecuting = false;
    if (node.type === 'files') {
      const outgoingEdges = edges.filter(edge => edge.source === node.id);
      isConnectedToExecuting = outgoingEdges.some(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        return (targetNode?.type === 'generate' || targetNode?.type === 'decision') &&
               targetNode.data?.executionState &&
               ['preparing', 'processing', 'completing'].includes(targetNode.data.executionState);
      });
    }
    
    return {
      ...node,
      data: {
        ...node.data,
        variables: (node.type === 'generate' || node.type === 'decision') ? variables : undefined,
        connectedResults: (node.type === 'generate' || node.type === 'decision') ? connectedResults : undefined,
        isConnectedToExecuting: node.type === 'files' ? isConnectedToExecuting : undefined,
        onModelChange: (node.type === 'generate' || node.type === 'decision')
          ? (model: string) => updateNodeData(node.id, { selectedModel: model })
          : undefined,
        onVariableNameChange: (node.type === 'generate' || node.type === 'decision')
          ? (name: string) => {
              if (validateVariableName(name, node.id)) {
                updateNodeData(node.id, { variableName: name.trim() });
              }
            }
          : undefined,
        onSystemPromptChange: node.type === 'generate'
          ? (text: string) => updateNodeData(node.id, { systemPrompt: text })
          : undefined,
        onUserPromptChange: node.type === 'generate'
          ? (text: string) => updateNodeData(node.id, { userPrompt: text })
          : undefined,
        onInstructionsChange: node.type === 'decision'
          ? (text: string) => updateNodeData(node.id, { instructions: text })
          : undefined,
        onChoicesChange: node.type === 'decision'
          ? (choices: string[]) => updateNodeData(node.id, { choices })
          : undefined,
        onSearchGroundingChange: node.type === 'generate'
          ? (enabled: boolean) => updateNodeData(node.id, { isSearchGroundingEnabled: enabled })
          : undefined,
        onReasoningChange: node.type === 'generate'
          ? (enabled: boolean) => updateNodeData(node.id, { isMapsGroundingEnabled: enabled })
          : undefined,
        onFilesChange: node.type === 'files'
          ? (files: any[]) => updateNodeData(node.id, { selectedFiles: files })
          : undefined,
        onContentChange: node.type === 'note'
          ? (content: string) => updateNodeData(node.id, { content })
          : undefined,
        onDelete: () => deleteNode(node.id),
        isHandleHighlighted: (handleId: string, handleType: 'source' | 'target') => 
          isHandleHighlighted(node.id, handleId, handleType),
        connectingFrom: connectingFrom,
      }
    };
  }), [nodes, edges, variables, connectingFrom, isHandleHighlighted, updateNodeData, deleteNode, validateVariableName]);

  return (
    <div className='fixed inset-0 z-50 bg-background'>
      {/* Notification Toast */}
      {notification.visible && (
        <div className={`-translate-x-1/2 slide-in-from-top-2 fixed top-6 left-1/2 z-[100] transform animate-in rounded-lg border-2 px-6 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out ${
          notification.type === 'error' 
            ? 'border-red-400/60 bg-red-500/90 text-white' 
            : notification.type === 'warning'
            ? 'border-yellow-400/60 bg-yellow-500/90 text-white'
            : notification.type === 'success'
            ? 'border-green-400/60 bg-green-500/90 text-white'
            : 'border-blue-400/60 bg-blue-500/90 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {notification.type === 'error' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              )}
              {notification.type === 'success' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              )}
              {notification.type === 'info' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              )}
            </div>
            <span className='font-medium text-sm'>{notification.message}</span>
            <button 
              onClick={() => setNotification(prev => ({ ...prev, visible: false }))}
              className='ml-2 flex-shrink-0 rounded-full p-1 transition-colors hover:bg-white/20'
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Header - Transparent with floating elements */}
      <div className='absolute top-0 right-0 left-0 z-60 flex items-center justify-between px-6 py-4'>
        {/* Left side - Title and back button floating */}
        <div className='flex items-center gap-4'>
          <Button
            variant="ghost"
            size="sm"
            className='h-10 w-10 rounded-full border-2 border-border/60 bg-background/60 p-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-border/80 hover:bg-background/80'
            onClick={() => window.history.back()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Button>
          <div className='flex items-center rounded-full border-2 border-border/60 bg-background/60 px-4 py-2 shadow-lg backdrop-blur-sm'>
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={() => {
                  if (tempTitle.trim()) {
                    setWorkflowTitle(tempTitle.trim());
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (tempTitle.trim()) {
                      setWorkflowTitle(tempTitle.trim());
                    }
                    setIsEditingTitle(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className='w-full bg-transparent font-semibold text-lg outline-none'
                placeholder='Titre du workflow'
              />
            ) : (
              <h1
                className='cursor-pointer font-semibold text-lg transition-opacity hover:opacity-70'
                onClick={() => {
                  setTempTitle(workflowTitle || 'New Workflow');
                  setIsEditingTitle(true);
                }}
                title='Cliquer pour modifier le titre'
              >
                {workflowTitle || 'New Workflow'}
              </h1>
            )}
          </div>
        </div>

        {/* Right side - Action buttons floating */}
        <div className='flex items-center gap-3'>


          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            size="sm"
            className='flex h-10 items-center gap-2 rounded-full border-2 border-green-500/60 bg-gradient-to-r from-green-600 to-green-700 px-4 shadow-green-500/20 shadow-lg backdrop-blur-sm transition-all duration-200 hover:from-green-700 hover:to-green-800 hover:shadow-green-500/30'
          >
            {isRunning ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon fill="currentColor" points="5,3 19,12 5,21" />
              </svg>
            )}
            {isRunning ? 'Running...' : 'Run'}
          </Button>
        </div>
      </div>
      
      <div className='relative h-full'>
      

      {/* Floating Node Palette - Always Visible */}
      <div className='fixed top-20 left-4 z-50 min-w-[160px] rounded-xl border-2 border-border/60 bg-background/50 p-4 shadow-sm backdrop-blur-sm'>
        <div className="space-y-4">
          <div>
            <div className='mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider'>Core</div>
            <div className="space-y-2">
              <button
                onClick={addGenerateNode}
                className='group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm transition-all duration-200 hover:scale-[1.02] hover:border-blue-200 hover:bg-blue-50 hover:shadow-md dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
              >
                <div className='flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-yellow-200'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-gray-700 dark:text-gray-800">
                    <path fill="currentColor" d="M18.5 10.255q0 .067-.003.133A1.54 1.54 0 0 0 17.473 10q-.243 0-.473.074V5.75a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75v4.505c0 .414.336.75.75.75h8.276l-.01.025l-.003.012l-.45 1.384l-.01.026l-.019.053H7.75a2.25 2.25 0 0 1-2.25-2.25V5.75A2.25 2.25 0 0 1 7.75 3.5h3.5v-.75a.75.75 0 0 1 .649-.743L12 2a.75.75 0 0 1 .743.649l.007.101l-.001.75h3.5a2.25 2.25 0 0 1 2.25 2.25zm-5.457 3.781l.112-.036H6.254a2.25 2.25 0 0 0-2.25 2.25v.907a3.75 3.75 0 0 0 1.305 2.844c1.563 1.343 3.802 2 6.691 2c2.076 0 3.817-.339 5.213-1.028a1.55 1.55 0 0 1-1.169-1.003l-.004-.012l-.03-.093c-1.086.422-2.42.636-4.01.636c-2.559 0-4.455-.556-5.713-1.638a2.25 2.25 0 0 1-.783-1.706v-.907a.75.75 0 0 1 .75-.75H12v-.003a1.54 1.54 0 0 1 1.031-1.456zM10.999 7.75a1.25 1.25 0 1 0-2.499 0a1.25 1.25 0 0 0 2.499 0m3.243-1.25a1.25 1.25 0 1 1 0 2.499a1.25 1.25 0 0 1 0-2.499m1.847 10.912a2.83 2.83 0 0 0-1.348-.955l-1.377-.448a.544.544 0 0 1 0-1.025l1.377-.448a2.84 2.84 0 0 0 1.76-1.762l.01-.034l.449-1.377a.544.544 0 0 1 1.026 0l.448 1.377a2.84 2.84 0 0 0 1.798 1.796l1.378.448l.027.007a.544.544 0 0 1 0 1.025l-1.378.448a2.84 2.84 0 0 0-1.798 1.796l-.447 1.377a.55.55 0 0 1-.2.263a.544.544 0 0 1-.827-.263l-.448-1.377a2.8 2.8 0 0 0-.45-.848m7.694 3.801l-.765-.248a1.58 1.58 0 0 1-.999-.998l-.249-.765a.302.302 0 0 0-.57 0l-.249.764a1.58 1.58 0 0 1-.983.999l-.766.248a.302.302 0 0 0 0 .57l.766.249a1.58 1.58 0 0 1 .999 1.002l.248.764a.303.303 0 0 0 .57 0l.25-.764a1.58 1.58 0 0 1 .998-.999l.766-.248a.302.302 0 0 0 0-.57z"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">AI Agent</span>
              </button>

              <button
                onClick={addDecisionNode}
                className='group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm transition-all duration-200 hover:scale-[1.02] hover:border-purple-200 hover:bg-purple-50 hover:shadow-md dark:hover:border-purple-800 dark:hover:bg-purple-950/30'
              >
                <div className='flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-purple-200'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-purple-700 dark:text-purple-800">
                    <path fill="currentColor" d="M7 10h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z"/>
                    <path fill="currentColor" d="M20.3 12.04L19.71 9.3c-.14-.6-.54-1.1-1.09-1.36l-2.25-1.07c-.22-.1-.46-.15-.71-.15h-2.53L12.5 6h-1l-.63.72H8.34c-.25 0-.49.05-.71.15L5.38 7.94c-.55.26-.95.76-1.09 1.36l-.59 2.74a2.08 2.08 0 0 0 .42 1.73l1.38 1.65v3.33c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-3.33l1.38-1.65c.38-.46.52-1.07.42-1.73M18 17.75c0 .14-.11.25-.25.25H6.25a.25.25 0 0 1-.25-.25v-2.91l.5.6c.26.31.65.49 1.06.49h9.13c.41 0 .8-.18 1.06-.49l.5-.6v2.91M19.04 13l-1.88 2.25c-.09.1-.22.16-.35.16H7.19c-.13 0-.26-.06-.35-.16L4.96 13a.51.51 0 0 1-.1-.42l.59-2.74c.04-.15.13-.27.27-.33l2.25-1.07c.06-.03.12-.04.18-.04h7.7c.06 0 .12.01.18.04l2.25 1.07c.14.06.23.18.27.33l.59 2.74c.03.15 0 .3-.1.42"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">Decision</span>
              </button>

              <button
                onClick={addNoteNode}
                className='group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm transition-all duration-200 hover:scale-[1.02] hover:border-amber-200 hover:bg-amber-50 hover:shadow-md dark:hover:border-amber-800 dark:hover:bg-amber-950/30'
              >
                <div className='flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-yellow-200'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-gray-700 dark:text-gray-800">
                    <path fill="currentColor" d="M3 17.75A3.25 3.25 0 0 0 6.25 21h4.915l.356-1.423l.02-.077H6.25a1.75 1.75 0 0 1-1.75-1.75V11h3.25l.184-.005A3.25 3.25 0 0 0 11 7.75V4.5h6.75c.966 0 1.75.784 1.75 1.75v4.982c.479-.19.994-.263 1.5-.22V6.25A3.25 3.25 0 0 0 17.75 3h-6.879a2.25 2.25 0 0 0-1.59.659L3.658 9.28A2.25 2.25 0 0 0 3 10.871zM7.75 9.5H5.561L9.5 5.561V7.75l-.006.144A1.75 1.75 0 0 1 7.75 9.5m11.35 3.17l-5.903 5.902a2.7 2.7 0 0 0-.706 1.247l-.458 1.831a1.087 1.087 0 0 0 1.319 1.318l1.83-.457a2.7 2.7 0 0 0 1.248-.707l5.902-5.902A2.286 2.286 0 0 0 19.1 12.67"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">Note</span>
              </button>
            </div>
          </div>

          <div className='border-border/40 border-t pt-3'>
            <div className='mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider'>Tools</div>
            <div className="space-y-2">
              <button
                onClick={addFilesNode}
                className='group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm transition-all duration-200 hover:scale-[1.02] hover:border-orange-200 hover:bg-orange-50 hover:shadow-md dark:hover:border-orange-800 dark:hover:bg-orange-950/30'
              >
                <div className='flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-yellow-200'>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-800">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10,9 9,9 8,9" />
                  </svg>
                </div>
                <span className="font-medium text-foreground">Files</span>
              </button>

              <button
                onClick={() => setIsVariablesModalOpen(true)}
                className='group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 text-sm transition-all duration-200 hover:scale-[1.02] hover:border-teal-200 hover:bg-teal-50 hover:shadow-md dark:hover:border-teal-800 dark:hover:bg-teal-950/30'
              >
                <div className='flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 shadow-sm transition-shadow group-hover:shadow-md dark:bg-teal-200'>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-700 dark:text-teal-800">
                    <path d="M7 8h10M7 12h10M7 16h10M3 8h0M3 12h0M3 16h0"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">Variables</span>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className='relative h-full w-full'>
        {/* Loading indicator */}
        {isLoading && (
          <div className='absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm'>
            <div className='flex items-center gap-3 rounded-lg border bg-background px-6 py-4 shadow-lg'>
              <div className='h-6 w-6 animate-spin rounded-full border-primary border-b-2' />
              <span className='font-medium text-sm'>Chargement du workflow...</span>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onEdgesDelete={onEdgesDelete}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="react-flow-custom"
          style={{
            backgroundColor: '#fafbfd'
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          panOnDrag={selectedTool === 'move'}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectionOnDrag={selectedTool === 'select'}
          panOnScroll={true}
          selectionMode={selectedTool === 'select' ? 'partial' : undefined}
          snapToGrid={snapToGridEnabled}
          snapGrid={[20, 20]}
        >
          <AutoFitView nodes={nodes} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="#e2e8f0"
            style={{
              zIndex: 0,
              opacity: 0.8
            }}
          />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'prompt': return '#3b82f6';
                case 'generate': return '#10b981';
                default: return '#6b7280';
              }
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
            position="bottom-right"
            style={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
        </ReactFlow>
      </div>

      {/* Edit Panel - Floating Box */}
      {isEditPanelOpen && editingNode && (
        <div className='fixed top-20 right-4 z-50 max-h-[80vh] w-80 overflow-y-auto rounded-xl border-2 border-border/60 bg-background/50 p-4 shadow-sm backdrop-blur-sm'>
            {/* Header */}
            <div className="mb-4">
              {showResults ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowResults(false)}
                        className='flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-muted/20'
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                      </button>
                      <h3 className="font-semibold text-base">Results</h3>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                  <p className='mt-1 text-muted-foreground text-xs'>
                    Generated content from {editingNode.data.variableName || 'AI Agent'}
                  </p>
                </div>
              ) : (
                <div>
                  {editingNode.type === 'generate' ? (
                    <div className="group relative">
                      <input
                        value={editingNode.data.variableName || ''}
                        onChange={(e) => {
                          updateNodeData(editingNode.id, { variableName: e.target.value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, variableName: e.target.value }
                          });
                        }}
                        placeholder="AI Agent"
                        className='w-full rounded border-none bg-transparent px-1 py-0.5 pr-6 font-semibold text-base outline-none transition-colors focus:bg-muted/30 group-hover:bg-muted/30'
                      />
                      <svg 
                        width="12" 
                        height="12" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        className='-translate-y-1/2 pointer-events-none absolute top-1/2 right-1 transform text-muted-foreground/50 transition-colors group-hover:text-muted-foreground'
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                    </div>
                  ) : editingNode.type === 'decision' ? (
                    <div className="group relative">
                      <input
                        value={editingNode.data.variableName || ''}
                        onChange={(e) => {
                          updateNodeData(editingNode.id, { variableName: e.target.value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, variableName: e.target.value }
                          });
                        }}
                        placeholder="Decision Node"
                        className='w-full rounded border-none bg-transparent px-1 py-0.5 pr-6 font-semibold text-base outline-none transition-colors focus:bg-muted/30 group-hover:bg-muted/30'
                      />
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className='-translate-y-1/2 pointer-events-none absolute top-1/2 right-1 transform text-muted-foreground/50 transition-colors group-hover:text-muted-foreground'
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                    </div>
                  ) : editingNode.type === 'files' ? (
                    <div className="group relative">
                      <input
                        value={editingNode.data.variableName || ''}
                        onChange={(e) => {
                          updateNodeData(editingNode.id, { variableName: e.target.value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, variableName: e.target.value }
                          });
                        }}
                        placeholder="Files"
                        className='w-full rounded border-none bg-transparent px-1 py-0.5 pr-6 font-semibold text-base outline-none transition-colors focus:bg-muted/30 group-hover:bg-muted/30'
                      />
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className='-translate-y-1/2 pointer-events-none absolute top-1/2 right-1 transform text-muted-foreground/50 transition-colors group-hover:text-muted-foreground'
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                    </div>
                  ) : (
                    <h3 className="font-semibold text-base">
                      {editingNode.type === 'note' ? 'Note' :
                       editingNode.type === 'variables' ? 'Global Variables' : 'Node'}
                    </h3>
                  )}
                  <p className='mt-1 text-muted-foreground text-xs'>
                    {editingNode.type === 'generate' ? 'Call the model with your instructions and tools' :
                     editingNode.type === 'decision' ? 'Make decisions based on AI response - routes to different paths' :
                     editingNode.type === 'note' ? 'Add notes and documentation' :
                     editingNode.type === 'files' ? 'Select and manage files' :
                     editingNode.type === 'variables' ? 'Define variables to use in your prompts with {{variable_name}}' : 'Configure this node'}
                  </p>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="space-y-4">
              {editingNode.type === 'generate' && !showResults && (
                <>
                  {/* System Prompt - Masqué en mode juridique */}
                  {!editingNode.data.isLegalEnabled && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className='font-medium text-muted-foreground text-xs'>System Prompt</Label>
                        <button
                          onClick={() => {
                            setExpandedField('systemPrompt');
                            setExpandedContent(editingNode.data.systemPrompt || '');
                          }}
                          className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                          </svg>
                        </button>
                      </div>
                      <HighlightedTextarea
                        value={editingNode.data.systemPrompt || ''}
                        onChange={(value) => {
                          updateNodeData(editingNode.id, { systemPrompt: value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, systemPrompt: value }
                          });
                        }}
                        placeholder="You are a helpful assistant."
                        className="min-h-[80px] resize-none text-sm"
                        variables={getAllAvailableVariables(editingNode.id)}
                        onVariableValidation={handleSystemPromptValidation}
                      />
                    </div>
                  )}

                  {/* Message informatif en mode juridique */}
                  {editingNode.data.isLegalEnabled && (
                    <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-50/50 px-3 py-2 text-xs dark:bg-purple-950/20">
                      <LegalIcon size={12} enabled={true} />
                      <span className="text-purple-700 dark:text-purple-300">
                        Mode juridique activé - Système prompt prédéfini appliqué automatiquement
                      </span>
                    </div>
                  )}

                  {/* User Prompt */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className='font-medium text-muted-foreground text-xs'>User Prompt</Label>
                      <button 
                        onClick={() => {
                          setExpandedField('userPrompt');
                          setExpandedContent(editingNode.data.userPrompt || '');
                        }}
                        className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                      </button>
                    </div>
                    <HighlightedTextarea
                      value={editingNode.data.userPrompt || ''}
                      onChange={(value) => {
                        updateNodeData(editingNode.id, { userPrompt: value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, userPrompt: value }
                        });
                      }}
                      placeholder="Enter your prompt..."
                      className="min-h-[60px] resize-none text-sm"
                      variables={getAllAvailableVariables(editingNode.id)}
                      onVariableValidation={handleUserPromptValidation}
                    />
                  </div>

                  {/* Model Selection - Label and custom dropdown */}
                  <div className="flex items-center justify-between">
                    <Label className='font-medium text-muted-foreground text-xs'>Model</Label>
                    <div className="relative">
                      <select
                        value={editingNode.data.selectedModel || 'chat-model-medium'}
                        onChange={(e) => {
                          updateNodeData(editingNode.id, { selectedModel: e.target.value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, selectedModel: e.target.value }
                          });
                        }}
                        className='cursor-pointer appearance-none bg-transparent pr-6 text-foreground text-sm focus:outline-none'
                        style={{
                          colorScheme: 'dark'
                        }}
                      >
                        <option value="chat-model-small" className="!bg-background !text-foreground dark:!bg-gray-800 dark:!text-white text-xs" style={{backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: '12px'}}>Small</option>
                        <option value="chat-model-medium" className="!bg-background !text-foreground dark:!bg-gray-800 dark:!text-white text-xs" style={{backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: '12px'}}>Medium</option>
                        <option value="chat-model-large" className="!bg-background !text-foreground dark:!bg-gray-800 dark:!text-white text-xs" style={{backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: '12px'}}>Large</option>
                      </select>
                      <svg 
                        width="12" 
                        height="12" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        className='-translate-y-1/2 pointer-events-none absolute top-1/2 right-0 transform text-muted-foreground'
                      >
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Search Grounding Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GoogleSearchIcon size={14} enabled={editingNode.data.isSearchGroundingEnabled} />
                      <span className='font-medium text-muted-foreground text-xs'>Google Search</span>
                    </div>
                    <button
                        onClick={() => {
                          const newValue = !editingNode.data.isSearchGroundingEnabled;
                          // Si on active Google Search, on désactive Google Maps et RAG
                          const updates = newValue
                            ? { isSearchGroundingEnabled: true, isMapsGroundingEnabled: false, isLegalEnabled: false }
                            : { isSearchGroundingEnabled: false };
                          updateNodeData(editingNode.id, updates);
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, ...updates }
                          });
                        }}
                        className={`relative h-5 w-10 rounded-full border transition-colors ${
                          editingNode.data.isSearchGroundingEnabled
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-border bg-muted'
                        }`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          editingNode.data.isSearchGroundingEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>

                    {/* Google Maps Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GoogleMapsIcon size={14} enabled={editingNode.data.isMapsGroundingEnabled} />
                        <span className='font-medium text-muted-foreground text-xs'>Google Maps</span>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !editingNode.data.isMapsGroundingEnabled;
                          // Si on active Google Maps, on désactive Google Search et RAG
                          const updates = newValue
                            ? { isMapsGroundingEnabled: true, isSearchGroundingEnabled: false, isLegalEnabled: false }
                            : { isMapsGroundingEnabled: false };
                          updateNodeData(editingNode.id, updates);
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, ...updates }
                          });
                        }}
                        className={`relative h-5 w-10 rounded-full border transition-colors ${
                          editingNode.data.isMapsGroundingEnabled
                            ? 'border-green-500 bg-green-500'
                            : 'border-border bg-muted'
                        }`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          editingNode.data.isMapsGroundingEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>

                    {/* Mode Juridique (Legal) Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LegalIcon size={14} enabled={editingNode.data.isLegalEnabled} />
                        <span className='font-medium text-muted-foreground text-xs'>Mode Juridique</span>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !editingNode.data.isLegalEnabled;
                          // Si on active Legal, désactiver Google Search et Google Maps (Legal active automatiquement Google Search)
                          const updates = newValue
                            ? { isLegalEnabled: true, isSearchGroundingEnabled: false, isMapsGroundingEnabled: false }
                            : { isLegalEnabled: false };
                          updateNodeData(editingNode.id, updates);
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, ...updates }
                          });
                        }}
                        className={`relative h-5 w-10 rounded-full border transition-colors ${
                          editingNode.data.isLegalEnabled
                            ? 'border-purple-700 bg-purple-700'
                            : 'border-border bg-muted'
                        }`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          editingNode.data.isLegalEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                </>
              )}

              {editingNode.type === 'note' && (
                <div className="space-y-1">
                  <Label className='font-medium text-muted-foreground text-xs'>Note Content</Label>
                  <Textarea
                    value={editingNode.data.content || ''}
                    onChange={(e) => {
                      updateNodeData(editingNode.id, { content: e.target.value });
                      setEditingNode({
                        ...editingNode,
                        data: { ...editingNode.data, content: e.target.value }
                      });
                    }}
                    placeholder="Add your note here..."
                    className="min-h-[120px] resize-none text-sm"
                  />
                </div>
              )}

              {editingNode.type === 'files' && (
                <>
                  {/* Files Selector (hidden if askBeforeRun is true) */}
                  {!editingNode.data.askBeforeRun && (
                    <FilesSelector
                      selectedFiles={editingNode.data.selectedFiles || []}
                      onFilesChange={(files) => {
                        updateNodeData(editingNode.id, { selectedFiles: files });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, selectedFiles: files }
                        });
                      }}
                    />
                  )}

                  {/* Ask Before Run Toggle (smaller, below file selector or at top if askBeforeRun is true) */}
                  <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2">
                    <Switch
                      id="files-ask-before-run"
                      checked={editingNode.data.askBeforeRun || false}
                      onCheckedChange={(checked) => {
                        updateNodeData(editingNode.id, { askBeforeRun: checked });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, askBeforeRun: checked }
                        });
                      }}
                      className="scale-75"
                    />
                    <Label htmlFor="files-ask-before-run" className='cursor-pointer text-muted-foreground text-xs'>
                      Demander avant le lancement
                    </Label>
                  </div>

                  {/* Description (only if askBeforeRun is true) */}
                  {editingNode.data.askBeforeRun && (
                    <div className="space-y-1">
                      <Label className='font-medium text-muted-foreground text-xs'>Description (optionnel)</Label>
                      <Textarea
                        value={editingNode.data.description || ''}
                        onChange={(e) => {
                          updateNodeData(editingNode.id, { description: e.target.value });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, description: e.target.value }
                          });
                        }}
                        placeholder="Décrivez quels fichiers sélectionner..."
                        className='min-h-[60px] resize-none text-xs'
                      />
                    </div>
                  )}
                </>
              )}

              {editingNode.type === 'decision' && !showResults && (
                <>
                  {/* Instructions (User Prompt) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className='font-medium text-muted-foreground text-xs'>Question</Label>
                      <button
                        onClick={() => {
                          setExpandedField('instructions');
                          setExpandedContent(editingNode.data.instructions || '');
                        }}
                        className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                      </button>
                    </div>
                    <HighlightedTextarea
                      value={editingNode.data.instructions || ''}
                      onChange={(value) => {
                        updateNodeData(editingNode.id, { instructions: value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, instructions: value }
                        });
                      }}
                      placeholder="Quelle question poser à l'IA ?"
                      className="min-h-[45px] resize-none text-xs"
                      variables={getAllAvailableVariables(editingNode.id)}
                      onVariableValidation={(hasInvalid, invalidVars) => {
                        setInvalidVariables(prev => ({
                          ...prev,
                          [`${editingNode.id}-instructions`]: { hasInvalid, variables: invalidVars }
                        }));
                      }}
                    />
                  </div>

                  {/* Choices */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className='font-medium text-muted-foreground text-xs'>Choix possibles</Label>
                      <button
                        onClick={() => {
                          const currentChoices = editingNode.data.choices || [];
                          const newChoices = [...currentChoices, `Choix ${currentChoices.length + 1}`];
                          updateNodeData(editingNode.id, { choices: newChoices });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, choices: newChoices }
                          });
                        }}
                        className='flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-600 transition-colors hover:bg-purple-500/20 dark:text-purple-400'
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Ajouter
                      </button>
                    </div>

                    {/* List of choices */}
                    <div className="space-y-1.5">
                      {(editingNode.data.choices || []).map((choice: string, index: number) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <div className='flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-purple-100 text-[10px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'>
                            {index + 1}
                          </div>
                          <Input
                            value={choice}
                            onChange={(e) => {
                              const newChoices = [...(editingNode.data.choices || [])];
                              newChoices[index] = e.target.value;
                              updateNodeData(editingNode.id, { choices: newChoices });
                              setEditingNode({
                                ...editingNode,
                                data: { ...editingNode.data, choices: newChoices }
                              });
                            }}
                            placeholder={`Choix ${index + 1}`}
                            className="h-7 flex-1 text-xs"
                          />
                          <button
                            onClick={() => {
                              const newChoices = (editingNode.data.choices || []).filter((_: string, i: number) => i !== index);
                              updateNodeData(editingNode.id, { choices: newChoices });
                              setEditingNode({
                                ...editingNode,
                                data: { ...editingNode.data, choices: newChoices }
                              });
                            }}
                            className='flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-red-500/10 text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400'
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Else choice info */}
                    <div className='mt-2 rounded border border-border/40 bg-muted/20 p-2'>
                      <div className="flex items-start gap-1.5">
                        <div className='mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-600 dark:bg-gray-800 dark:text-gray-400'>
                          ?
                        </div>
                        <span className='text-[10px] text-muted-foreground leading-relaxed'>
                          Une sortie "Else" est toujours disponible pour les réponses non reconnues
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Show Results Section */}
              {editingNode.type === 'generate' && editingNode.data.result && !showResults && (
                <div className='mt-6 space-y-2 border-border/40 border-t pt-4'>
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setShowResults(true)}
                      className='flex items-center gap-2 rounded bg-transparent px-3 py-1.5 text-foreground text-sm transition-colors hover:bg-muted/50'
                    >
                      Show Results
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Results View - replaces content in same section */}
              {showResults && editingNode.type === 'generate' && editingNode.data.result && (
                <div className="space-y-4">
                  {/* Full Results Content */}
                  <div className='rounded-lg border border-border/40 bg-muted/30'>
                    <div className='flex items-center justify-between border-border/40 border-b p-3'>
                      <span className='font-medium text-muted-foreground text-xs'>Generated Content</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            // Create and download markdown file
                            const content = editingNode.data.result || '';
                            const fileName = `${editingNode.data.variableName || 'ai-result'}-${Date.now()}.md`;
                            const blob = new Blob([content], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                          className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                          title="Download as Markdown"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                        <button 
                          onClick={() => {
                            setExpandedField('result');
                            setExpandedContent(editingNode.data.result || '');
                          }}
                          className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                          title="Expand"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className='max-h-48 overflow-y-auto whitespace-pre-wrap text-foreground text-sm leading-relaxed'>
                        {editingNode.data.result}
                      </div>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className='rounded-lg border border-border/40 bg-background/50 p-3'>
                    <h4 className='mb-2 font-medium text-foreground text-xs'>Generation Details</h4>
                    <div className='space-y-1 text-muted-foreground text-xs'>
                      <div className="flex justify-between">
                        <span>Model:</span>
                        <span className="font-mono">{editingNode.data.selectedModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Length:</span>
                        <span>{editingNode.data.result.length} characters</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Words:</span>
                        <span>{editingNode.data.result.split(' ').length} words</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Google Search:</span>
                        <span>{editingNode.data.isSearchGroundingEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Google Maps:</span>
                        <span>{editingNode.data.isMapsGroundingEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Variables Panel Content */}
              {editingNode.type === 'variables' && (
                <div className="space-y-3">
                  {/* Add Button */}
                  <Button
                    onClick={() => {
                      setVariableModal({ isOpen: true, mode: 'add' });
                      setModalAskBeforeRun(false);
                    }}
                    className='h-8 w-full rounded-lg bg-orange-600 text-white text-xs hover:bg-orange-700'
                    size="sm"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add Variable
                  </Button>

                  {/* Variables List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className='font-medium text-muted-foreground text-xs'>Variables</Label>
                      <span className='text-muted-foreground/60 text-xs'>({variables.length})</span>
                    </div>
                    
                    {variables.length === 0 ? (
                      <div className='rounded-lg bg-muted/20 p-4 text-center'>
                        <div className="text-muted-foreground text-xs">No variables defined yet</div>
                        <div className='mt-1 text-muted-foreground/60 text-xs'>Use {'{{variable_name}}'} in prompts</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {variables.map((variable) => (
                          <div key={variable.id} className='group flex items-center justify-between rounded-lg bg-muted/20 p-2 transition-colors hover:bg-muted/30'>
                            <button
                              onClick={() => {
                                setVariableModal({
                                  isOpen: true,
                                  mode: 'edit',
                                  variable: variable
                                });
                                setModalAskBeforeRun(variable.askBeforeRun || false);
                              }}
                              className='flex-1 text-left font-medium text-foreground text-xs transition-colors hover:text-orange-600'
                            >
                              {`{{${variable.name}}}`} 
                            </button>
                            <button
                              onClick={() => {
                                setVariables(variables.filter(v => v.id !== variable.id));
                              }}
                              className='flex h-5 w-5 items-center justify-center rounded text-red-500 opacity-0 transition-all hover:bg-red-500/10 group-hover:opacity-100'
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
      )}

      {/* Variable Modal */}
      {variableModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setVariableModal({ isOpen: false, mode: 'add' });
              setModalAskBeforeRun(false);
            }}
          />
          
          {/* Modal */}
          <div className='zoom-in-95 relative max-h-[80vh] w-96 max-w-[90vw] animate-in overflow-y-auto rounded-xl border-2 border-border/60 bg-background/95 p-6 shadow-2xl backdrop-blur-sm duration-200'>
            {/* Header */}
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='font-semibold text-lg'>
                {variableModal.mode === 'add' ? 'Add Variable' : 'Edit Variable'}
              </h3>
              <button
                onClick={() => {
                  setVariableModal({ isOpen: false, mode: 'add' });
                  setModalAskBeforeRun(false);
                }}
                className='flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted/30'
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <Label className='mb-2 block font-medium text-muted-foreground text-sm'>Variable Name</Label>
                <input
                  id="modal-var-name"
                  defaultValue={variableModal.variable?.name || ''}
                  placeholder="Enter variable name (e.g., company_name)"
                  className='w-full rounded-lg border-2 border-border/60 bg-background px-3 py-2.5 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                />
                <div className='mt-1.5 text-muted-foreground text-xs'>
                  Use in prompts with: <span className='rounded bg-orange-50 px-1 py-0.5 font-mono text-orange-600 dark:bg-orange-900/20'>{'{{variable_name}}'}</span>
                </div>
              </div>

              <div>
                <Label className='mb-2 block font-medium text-muted-foreground text-sm'>Variable Value</Label>
                <textarea
                  id="modal-var-value"
                  defaultValue={variableModal.variable?.value || ''}
                  placeholder={modalAskBeforeRun ? "La valeur sera demandée au lancement..." : "Enter the value for this variable..."}
                  rows={4}
                  disabled={modalAskBeforeRun}
                  className='w-full resize-none rounded-lg border-2 border-border/60 bg-background px-3 py-2.5 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50'
                />
                {modalAskBeforeRun && (
                  <div className='mt-1.5 text-muted-foreground text-xs'>
                    💡 La valeur sera demandée lors du lancement du workflow
                  </div>
                )}
              </div>

              <div>
                <Label className='mb-2 block font-medium text-muted-foreground text-sm'>Description (optional)</Label>
                <textarea
                  id="modal-var-description"
                  defaultValue={variableModal.variable?.description || ''}
                  placeholder="Décrivez à quoi sert cette variable..."
                  rows={3}
                  className='w-full resize-none rounded-lg border-2 border-border/60 bg-background px-3 py-2.5 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                />
                <div className='mt-1.5 text-muted-foreground text-xs'>
                  Cette description s'affichera avec une icône ℹ️ lors du lancement
                </div>
              </div>

              {/* Ask before run toggle */}
              <div className="flex items-center gap-3 rounded-lg border-2 border-border/60 bg-muted/20 p-3">
                <Switch
                  id="modal-var-ask-before-run"
                  checked={modalAskBeforeRun}
                  onCheckedChange={setModalAskBeforeRun}
                />
                <Label htmlFor="modal-var-ask-before-run" className="cursor-pointer text-sm">
                  Demander avant le lancement
                </Label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setVariableModal({ isOpen: false, mode: 'add' });
                    setModalAskBeforeRun(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const nameInput = document.getElementById('modal-var-name') as HTMLInputElement;
                    const valueInput = document.getElementById('modal-var-value') as HTMLTextAreaElement;
                    const descriptionInput = document.getElementById('modal-var-description') as HTMLTextAreaElement;

                    if (nameInput?.value.trim() && (valueInput?.value.trim() || modalAskBeforeRun)) {
                      if (variableModal.mode === 'add') {
                        const newVariable = {
                          id: `var-${Date.now()}`,
                          name: nameInput.value.trim(),
                          value: modalAskBeforeRun ? '' : valueInput.value.trim(),
                          askBeforeRun: modalAskBeforeRun,
                          description: descriptionInput?.value.trim() || undefined,
                        };
                        setVariables([...variables, newVariable]);
                      } else if (variableModal.variable) {
                        setVariables(variables.map(v =>
                          v.id === variableModal.variable?.id
                            ? {
                                ...v,
                                name: nameInput.value.trim(),
                                value: modalAskBeforeRun ? '' : valueInput.value.trim(),
                                askBeforeRun: modalAskBeforeRun,
                                description: descriptionInput?.value.trim() || undefined,
                              }
                            : v
                        ));
                      }
                      setVariableModal({ isOpen: false, mode: 'add' });
                      setModalAskBeforeRun(false);
                    }
                  }}
                  className='flex-1 bg-orange-600 text-white hover:bg-orange-700'
                >
                  {variableModal.mode === 'add' ? 'Add Variable' : 'Update Variable'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <div className='-translate-x-1/2 fixed bottom-6 left-1/2 z-50 flex transform items-center gap-1 rounded-full border-2 border-border/60 bg-background/50 p-2 shadow-sm backdrop-blur-sm'>
        {/* Select Tool */}
        <button
          onClick={() => setSelectedTool('select')}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            selectedTool === 'select' 
              ? 'border border-border bg-background text-foreground' 
              : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
          }`}
          title="Select"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            <path d="M13 13l6 6"/>
          </svg>
        </button>

        {/* Move Tool */}
        <button
          onClick={() => setSelectedTool('move')}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            selectedTool === 'move' 
              ? 'border border-border bg-background text-foreground' 
              : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
          }`}
          title="Move"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
          </svg>
        </button>

        {/* Undo Tool */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            canUndo 
              ? 'text-muted-foreground hover:bg-background/20 hover:text-foreground' 
              : 'cursor-not-allowed text-muted-foreground/30'
          }`}
          title="Undo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>

        {/* Redo Tool */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            canRedo
              ? 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/30'
          }`}
          title="Redo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6"/>
            <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border/60" />

        {/* Snap to Grid Toggle */}
        <button
          onClick={() => setSnapToGridEnabled(!snapToGridEnabled)}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            snapToGridEnabled
              ? 'border border-border bg-background text-foreground'
              : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
          }`}
          title={snapToGridEnabled ? "Désactiver l'alignement sur la grille" : "Activer l'alignement sur la grille"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
      </div>

      {/* Workflow Console - Moved to Left */}
      <WorkflowConsole
        isOpen={isConsoleOpen}
        onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
        executionLogs={executionLogs}
        variables={variables}
        nodes={nodes}
      />

      {/* Save Workflow Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentWorkflowId ? 'Mettre à jour le workflow' : 'Sauvegarder le workflow'}</DialogTitle>
            <DialogDescription>
              {currentWorkflowId 
                ? 'Modifiez les informations de votre workflow.' 
                : 'Donnez un nom à votre workflow pour le sauvegarder dans votre bibliothèque.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="workflow-title">
                Nom du workflow <span className="text-red-500">*</span>
              </Label>
              <Input
                id="workflow-title"
                placeholder="Ex: Mon workflow d'analyse"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workflow-description">
                Description (optionnel)
              </Label>
              <Textarea
                id="workflow-description"
                placeholder="Décrivez brièvement ce que fait ce workflow..."
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowSaveModal(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button 
              onClick={saveWorkflow}
              disabled={isSaving || !saveTitle.trim()}
            >
              {isSaving 
                ? (currentWorkflowId ? 'Mise à jour...' : 'Sauvegarde...') 
                : (currentWorkflowId ? 'Mettre à jour' : 'Sauvegarder')
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Field Modal */}
      {expandedField !== null && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-sm'>
          <div className='h-[70vh] w-[90vw] rounded-lg border border-border bg-background shadow-lg'>
            {expandedField === 'result' ? (
              <div className='h-full overflow-y-auto p-6'>
                <div className='whitespace-pre-wrap text-foreground text-sm leading-relaxed'>
                  {expandedContent}
                </div>
              </div>
            ) : (
              <div className='relative flex h-full w-full'>
                {/* Left side - Text Editor */}
                <div className='flex-1 p-4 pr-2'>
                  <HighlightedTextarea
                    value={expandedContent}
                    onChange={(value) => {
                      setExpandedContent(value);
                      if (expandedField === 'userPrompt') {
                        updateNodeData(editingNode.id, { userPrompt: value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, userPrompt: value }
                        });
                      } else if (expandedField === 'systemPrompt') {
                        updateNodeData(editingNode.id, { systemPrompt: value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, systemPrompt: value }
                        });
                      }
                    }}
                    className='h-full text-sm'
                    placeholder={expandedField === 'userPrompt' ? 'Entrez votre prompt...' : 'Entrez les instructions...'}
                    variables={getAllAvailableVariables(editingNode?.id)}
                    noBorder={true}
                  />
                </div>
                
                {/* Right side - Variables Panel */}
                <div className='w-80 border-border border-l p-6 pl-3'>
                  <div className='flex h-full flex-col'>
                    <h3 className='mb-4 font-semibold text-lg'>Variables disponibles</h3>

                    {/* Predefined Variables */}
                    <div className='mb-6'>
                      <h4 className='mb-2 font-medium text-muted-foreground text-sm'>Variables prédéfinies</h4>
                      <div className='space-y-1'>
                        {predefinedVariables.map((variable) => (
                          <button
                            key={variable.id}
                            onClick={() => {
                              const placeholder = `{{${variable.name}}}`;
                              setExpandedContent(expandedContent + placeholder);
                              if (expandedField === 'userPrompt') {
                                const newValue = expandedContent + placeholder;
                                updateNodeData(editingNode.id, { userPrompt: newValue });
                                setEditingNode({
                                  ...editingNode,
                                  data: { ...editingNode.data, userPrompt: newValue }
                                });
                              } else if (expandedField === 'systemPrompt') {
                                const newValue = expandedContent + placeholder;
                                updateNodeData(editingNode.id, { systemPrompt: newValue });
                                setEditingNode({
                                  ...editingNode,
                                  data: { ...editingNode.data, systemPrompt: newValue }
                                });
                              }
                            }}
                            className='w-full rounded border border-purple-300 border-dashed bg-purple-50 p-2 text-left transition-colors hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/20 dark:hover:bg-purple-900/30'
                          >
                            <div className='font-mono text-purple-700 text-sm dark:text-purple-300'>
                              {`{{${variable.name}}}`}
                            </div>
                            <div className='truncate text-purple-600 text-xs dark:text-purple-400'>
                              {variable.value}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Global Variables */}
                    <div className='mb-6'>
                      <h4 className='mb-2 font-medium text-muted-foreground text-sm'>Variables globales</h4>
                      <div className='space-y-1'>
                        {variables.map((variable) => {
                          const isAskBeforeRun = variable.askBeforeRun;
                          return (
                            <div key={variable.id} className='group relative'>
                              <button
                                onClick={() => {
                                  const placeholder = `{{${variable.name}}}`;
                                  setExpandedContent(expandedContent + placeholder);
                                  if (expandedField === 'userPrompt') {
                                    const newValue = expandedContent + placeholder;
                                    updateNodeData(editingNode.id, { userPrompt: newValue });
                                    setEditingNode({
                                      ...editingNode,
                                      data: { ...editingNode.data, userPrompt: newValue }
                                    });
                                  } else if (expandedField === 'systemPrompt') {
                                    const newValue = expandedContent + placeholder;
                                    updateNodeData(editingNode.id, { systemPrompt: newValue });
                                    setEditingNode({
                                      ...editingNode,
                                      data: { ...editingNode.data, systemPrompt: newValue }
                                    });
                                  }
                                }}
                                className={`w-full rounded border border-dashed p-2 text-left transition-colors ${
                                  isAskBeforeRun
                                    ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/20 dark:hover:bg-orange-900/30'
                                    : 'border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/30'
                                }`}
                              >
                                <div className={`font-mono text-sm ${
                                  isAskBeforeRun
                                    ? 'text-orange-700 dark:text-orange-300'
                                    : 'text-green-700 dark:text-green-300'
                                }`}>
                                  {`{{${variable.name}}}`}
                                </div>
                                <div className={`truncate text-xs ${
                                  isAskBeforeRun
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {variable.value || 'Aucune valeur'}
                                </div>
                              </button>
                              {/* Edit pencil icon */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVariableModal({
                                    isOpen: true,
                                    mode: 'edit',
                                    variable: variable
                                  });
                                  setModalAskBeforeRun(variable.askBeforeRun || false);
                                }}
                                className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 ${
                                  isAskBeforeRun
                                    ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-800 dark:text-orange-400 dark:hover:bg-orange-700'
                                    : 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-800 dark:text-green-400 dark:hover:bg-green-700'
                                }`}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Add Global Variable Button */}
                        <button
                          onClick={() => setVariableModal({ isOpen: true, mode: 'add' })}
                          className='flex w-full items-center justify-center gap-2 rounded border border-gray-300 border-dashed bg-gray-50 p-2 text-left transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/20 dark:hover:bg-gray-900/30'
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          <span className='text-muted-foreground text-sm'>Ajouter dans variable globale</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* AI Generator Variables */}
                    {(() => {
                      const aiVariables = getAllAvailableVariables(editingNode?.id)
                        .filter(v => v.id?.startsWith('ai-node-'));
                      
                      if (aiVariables.length > 0) {
                        return (
                          <div className='mb-6'>
                            <h4 className='mb-2 font-medium text-muted-foreground text-sm'>Réponses AI Agents</h4>
                            <div className='space-y-1'>
                              {aiVariables.map((variable) => (
                                <button
                                  key={variable.id}
                                  onClick={() => {
                                    const placeholder = `{{${variable.name}}}`;
                                    setExpandedContent(expandedContent + placeholder);
                                    if (expandedField === 'userPrompt') {
                                      const newValue = expandedContent + placeholder;
                                      updateNodeData(editingNode.id, { userPrompt: newValue });
                                      setEditingNode({
                                        ...editingNode,
                                        data: { ...editingNode.data, userPrompt: newValue }
                                      });
                                    } else if (expandedField === 'systemPrompt') {
                                      const newValue = expandedContent + placeholder;
                                      updateNodeData(editingNode.id, { systemPrompt: newValue });
                                      setEditingNode({
                                        ...editingNode,
                                        data: { ...editingNode.data, systemPrompt: newValue }
                                      });
                                    }
                                  }}
                                  className='w-full rounded border border-blue-300 border-dashed bg-blue-50 p-2 text-left transition-colors hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                                >
                                  <div className='font-mono text-blue-700 text-sm dark:text-blue-300'>
                                    {`{{${variable.name}}}`}
                                  </div>
                                  <div className='truncate text-blue-600 text-xs dark:text-blue-400'>
                                    {variable.value ? 'Réponse disponible' : 'Pas encore exécuté'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* No variables message */}
                    {variables.length === 0 && getAllAvailableVariables(editingNode?.id).filter(v => v.id?.startsWith('ai-node-')).length === 0 && (
                      <div className='py-8 text-center text-muted-foreground text-sm'>
                        Aucune variable disponible.<br/>
                        Créez des variables globales ou connectez des AI Agents.
                      </div>
                    )}
                  </div>
                </div>
                
                <Button 
                  onClick={() => setExpandedField(null)}
                  className='absolute right-6 bottom-6 px-4 py-2'
                >
                  Sauvegarder
                </Button>
              </div>
            )}
            
            {/* Close on click outside or ESC */}
            <div
              className='-z-10 fixed inset-0'
              onClick={() => setExpandedField(null)}
            />
          </div>
        </div>
      )}

      {/* Variables Management Modal */}
      {isVariablesModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsVariablesModalOpen(false)}
          />

          {/* Modal */}
          <div className='zoom-in-95 relative max-h-[80vh] w-96 max-w-[90vw] animate-in overflow-y-auto rounded-xl border-2 border-border/60 bg-background/95 p-6 shadow-2xl backdrop-blur-sm duration-200'>
            {/* Header */}
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='font-semibold text-lg'>Variables disponibles</h3>
              <button
                onClick={() => setIsVariablesModalOpen(false)}
                className='flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted/30'
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Variables prédéfinies */}
            <div className='mb-6'>
              <h4 className='mb-2 font-medium text-muted-foreground text-sm'>Variables prédéfinies</h4>
              <div className='space-y-1'>
                {predefinedVariables.map((variable) => (
                  <button
                    key={variable.id}
                    className='w-full rounded border border-purple-300 border-dashed bg-purple-50 p-2 text-left transition-colors hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/20 dark:hover:bg-purple-900/30'
                  >
                    <div className='font-mono text-purple-700 text-sm dark:text-purple-300'>
                      {`{{${variable.name}}}`}
                    </div>
                    <div className='truncate text-purple-600 text-xs dark:text-purple-400'>
                      {variable.value}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Variables globales */}
            <div className='mb-6'>
              <h4 className='mb-2 font-medium text-muted-foreground text-sm'>Variables globales</h4>
              <div className='space-y-1'>
                {variables.map((variable) => {
                  const isAskBeforeRun = variable.askBeforeRun;
                  return (
                    <div key={variable.id} className='group relative'>
                      <button
                        className={`w-full rounded border border-dashed p-2 text-left transition-colors ${
                          isAskBeforeRun
                            ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/20 dark:hover:bg-orange-900/30'
                            : 'border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/30'
                        }`}
                      >
                        <div className={`font-mono text-sm ${
                          isAskBeforeRun
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-green-700 dark:text-green-300'
                        }`}>
                          {`{{${variable.name}}}`}
                        </div>
                        <div className={`truncate text-xs ${
                          isAskBeforeRun
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {variable.value || variable.defaultValue || 'Aucune valeur'}
                        </div>
                      </button>
                      {/* Edit and Delete icons */}
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVariableModal({
                              isOpen: true,
                              mode: 'edit',
                              variable: variable
                            });
                            setModalAskBeforeRun(variable.askBeforeRun || false);
                            setIsVariablesModalOpen(false);
                          }}
                          className={`flex h-5 w-5 items-center justify-center rounded transition-opacity hover:opacity-100 ${
                            isAskBeforeRun
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-800 dark:text-orange-400 dark:hover:bg-orange-700'
                              : 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-800 dark:text-green-400 dark:hover:bg-green-700'
                          }`}
                          title="Modifier"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVariable(variable.id, variable.name);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded bg-red-100 text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900/70"
                          title="Supprimer"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Global Variable Button */}
                <button
                  onClick={() => {
                    setVariableModal({ isOpen: true, mode: 'add' });
                    setIsVariablesModalOpen(false);
                  }}
                  className='flex w-full items-center justify-center gap-2 rounded border border-gray-300 border-dashed bg-gray-50 p-2 text-left transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/20 dark:hover:bg-gray-900/30'
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span className='text-muted-foreground text-sm'>Ajouter dans variable globale</span>
                </button>
              </div>
            </div>

            {/* Footer button */}
            <Button
              onClick={() => setIsVariablesModalOpen(false)}
              className="w-full"
              variant="outline"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Pre-run Variables Modal */}
      <PreRunVariablesModal
        isOpen={showPreRunModal}
        onClose={() => setShowPreRunModal(false)}
        variables={variables}
        filesNodes={nodes
          .filter(node => node.type === 'files' && node.data.askBeforeRun)
          .map(node => ({
            id: node.id,
            variableName: node.data.variableName || 'Files',
            description: node.data.description,
            selectedFiles: node.data.selectedFiles || []
          }))
        }
        onConfirm={handlePreRunConfirm}
      />

      {/* Delete Variable Confirmation Modal */}
      {deleteVariableConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteVariableConfirmation(null)}
          />

          {/* Modal */}
          <div className="zoom-in-95 relative w-[500px] max-w-[90vw] animate-in overflow-hidden rounded-xl border border-red-500/20 bg-background shadow-2xl duration-200">
            {/* Header */}
            <div className='flex items-center gap-3 border-red-500/20 border-b bg-red-500/5 px-5 py-4'>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h3 className="flex-1 font-semibold text-sm">Variable en cours d'utilisation</h3>
              <button
                onClick={() => setDeleteVariableConfirmation(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-red-500/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-relaxed">
                La variable <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{`{{${deleteVariableConfirmation.variableName}}}`}</span> est utilisée dans <strong>{deleteVariableConfirmation.usedInNodes.length}</strong> bloc{deleteVariableConfirmation.usedInNodes.length > 1 ? 's' : ''} :
              </p>

              {/* List of nodes using the variable */}
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                {deleteVariableConfirmation.usedInNodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 rounded bg-background px-3 py-2 text-xs"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 font-semibold text-[10px] text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium">{node.label}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {node.type}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  ⚠️ Vous devez d'abord retirer cette variable des blocs listés ci-dessus avant de pouvoir la supprimer.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className='flex gap-2 border-border border-t px-5 py-3'>
              <Button
                variant="outline"
                onClick={() => setDeleteVariableConfirmation(null)}
                size="sm"
                className="flex-1"
              >
                Compris
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}