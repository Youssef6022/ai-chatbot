'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  MiniMap,
  BackgroundVariant,
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
import { CustomEdge } from '@/components/workflow/custom-edge';
import type { Variable } from '@/components/workflow/variables-panel';
import { WorkflowConsole } from '@/components/workflow/workflow-console';
import { HighlightedTextarea } from '@/components/workflow/highlighted-textarea';
import { GlobeIcon } from '@/components/icons';
import { BrainIcon } from 'lucide-react';
import { toast } from 'sonner';
import { chatModels } from '@/lib/ai/models';

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

const nodeTypes = {
  generate: GenerateNode,
  files: FilesNode,
  note: NoteNode,
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
      isReasoningEnabled: false,
      onModelChange: () => {},
      onVariableNameChange: () => {},
      onSystemPromptChange: () => {},
      onUserPromptChange: () => {},
      onDelete: () => {},
    },
  },
];

const initialEdges: Edge[] = [];

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
    
    // Start with generate nodes
    nodes.filter(node => node.type === 'generate').forEach(node => {
      visit(node.id);
    });
    
    return order.filter(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.type === 'generate';
    });
  }, [nodes, edges]);
  
  // Helper function to check if two nodes are in the same connected component
  const areNodesConnected = useCallback((nodeId1: string, nodeId2: string) => {
    const visited = new Set<string>();
    const toVisit = [nodeId1];
    
    while (toVisit.length > 0) {
      const currentId = toVisit.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      if (currentId === nodeId2) return true;
      
      // Add all connected nodes (both incoming and outgoing edges)
      edges.forEach(edge => {
        if (edge.source === currentId && !visited.has(edge.target)) {
          toVisit.push(edge.target);
        }
        if (edge.target === currentId && !visited.has(edge.source)) {
          toVisit.push(edge.source);
        }
      });
    }
    
    return false;
  }, [edges]);

  // Get all available variables (global + AI Generator results)
  const getAllAvailableVariables = useCallback((currentNodeId?: string) => {
    const allVariables: Variable[] = [...variables];
    
    if (currentNodeId) {
      // Calculate execution order to validate which variables are available
      const executionOrder = getExecutionOrder();
      const currentNodeIndex = executionOrder.indexOf(currentNodeId);
      
      // Add AI Generator results as variables, but only from nodes that execute BEFORE the current node
      const generateNodes = nodes.filter(node => 
        node.type === 'generate' && 
        node.data.variableName &&
        node.id !== currentNodeId  // Exclude current node
      );
      
      generateNodes.forEach(node => {
        const nodeIndex = executionOrder.indexOf(node.id);
        // Only add variables from nodes that:
        // 1. Execute before the current node (nodeIndex < currentNodeIndex)
        // 2. Are connected to the current node in the same component
        if (nodeIndex !== -1 && currentNodeIndex !== -1 && nodeIndex < currentNodeIndex && areNodesConnected(node.id, currentNodeId)) {
          allVariables.push({
            id: `ai-node-${node.id}`,
            name: node.data.variableName,
            value: node.data.result || ''
          });
        }
      });
    } else {
      // If no current node specified, include all generate nodes (for general validation)
      const generateNodes = nodes.filter(node => 
        node.type === 'generate' && 
        node.data.variableName
      );
      
      generateNodes.forEach(node => {
        allVariables.push({
          id: `ai-node-${node.id}`,
          name: node.data.variableName,
          value: node.data.result || ''
        });
      });
    }
    
    return allVariables;
  }, [variables, nodes, edges, getExecutionOrder, areNodesConnected]);
  
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
    variable?: { id: string; name: string; value: string };
  }>({ isOpen: false, mode: 'add' });

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
    } else if (importData) {
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
      
      // Files → Generate files
      if (sourceNode.type === 'files' && targetNode.type === 'generate' && 
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
      // Cas 2: Files → Generate (connexions de fichiers)
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
    
    // Files → Generate (files)
    if (sourceNode.type === 'files' && targetNode.type === 'generate' && 
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
        isReasoningEnabled: false,
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
    const newNode = {
      id: `files-${Date.now()}`,
      type: 'files',
      position: { x: Math.random() * 300, y: Math.random() * 300 + 200 },
      data: {
        label: 'Files',
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

  const handleRun = useCallback(async () => {
    // Validate that all AI Generators have User Prompts
    const generateNodes = nodes.filter(node => node.type === 'generate');
    const nodesWithoutUserPrompt = generateNodes.filter(node => 
      !node.data.userPrompt || node.data.userPrompt.trim() === ''
    );
    
    if (nodesWithoutUserPrompt.length > 0) {
      const nodeNames = nodesWithoutUserPrompt.map(node => 
        node.data.variableName || node.data.label || 'Unnamed AI Agent'
      ).join(', ');
      
      showNotification(`Cannot run workflow: The following AI Generator(s) are missing User Prompts: ${nodeNames}`, 'error');
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

    if (nodesWithInvalidVariables.length > 0) {
      const invalidVarsList = nodesWithInvalidVariables.map(({ node, invalidVars }) => {
        const nodeName = node.data.variableName || node.data.label || 'Unnamed AI Agent';
        return `${nodeName}: {{${invalidVars.join('}}, {{')}}}`; 
      }).join('; ');
      
      showNotification(`Cannot run workflow: The following variables are not defined: ${invalidVarsList}`, 'error');
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
      // First, clear all previous results from Generate nodes before starting
      generateNodes.forEach(node => {
        updateNodeData(node.id, { result: '', isLoading: false, executionState: 'idle' });
      });

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create execution order based on dependencies
      const executionOrder = getExecutionOrder();
      
      // Execute nodes in proper order
      for (const nodeId of executionOrder) {
        const currentNodeState = await new Promise<any>(resolve => {
          setNodes(currentNodes => {
            const node = currentNodes.find(n => n.id === nodeId);
            resolve(node);
            return currentNodes;
          });
        });
        
        if (currentNodeState?.type === 'generate') {
          await processGenerateNodeInOrder(nodeId);
        }
      }
      
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
    }
  }, [nodes, updateNodeData, setNodes, invalidVariables, showNotification]);
  
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

  // Helper function to process prompt text with variables
  const processPromptText = (text: string, latestNodes: any[]) => {
    let processedText = text;
    
    // Replace global variables (double braces)
    variables.forEach(variable => {
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
    return new Promise<void>((resolve, reject) => {
      setNodes(currentNodes => {
        const generateNode = currentNodes.find(n => n.id === generateNodeId);
        if (!generateNode) {
          resolve();
          return currentNodes;
        }
        
        // Find connected input and files nodes
        const inputEdge = edges.find(edge => edge.target === generateNodeId && edge.targetHandle === 'input');
        const filesEdges = edges.filter(edge => edge.target === generateNodeId && edge.targetHandle === 'files');
        
        // Process in background
        (async () => {
          try {
            await processGenerateNode(generateNode, currentNodes, inputEdge, filesEdges);
            resolve();
          } catch (error) {
            reject(error);
          }
        })();
        
        return currentNodes;
      });
    });
  };
  
  const processGenerateNode = async (generateNode: any, currentNodes: any[], inputEdge?: any, filesEdges?: any[]) => {
    try {
      const nodeName = generateNode.data.variableName || generateNode.data.label || 'AI Agent';
      
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
      let systemPrompt = currentGenerateNode?.data?.systemPrompt || '';
      let userPrompt = currentGenerateNode?.data?.userPrompt || '';
      
      // Process variables in the prompts
      systemPrompt = processPromptText(systemPrompt, latestNodes);
      userPrompt = processPromptText(userPrompt, latestNodes);
      
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
          isReasoningEnabled: generateNode.data.isReasoningEnabled || false,
        }),
      });
      
      if (response.ok) {
        const result = await response.text();
        // Set completed state (green) and keep it
        updateNodeData(generateNode.id, { result, isLoading: false, executionState: 'completed' });
        
        // Log success
        addExecutionLog('success', `Generation completed successfully`, generateNode.id, nodeName);
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
      
      // Add animation class for Generate to Generate connections
      if (sourceNode?.type === 'generate' && targetNode?.type === 'generate' && 
          edge.sourceHandle === 'output' && edge.targetHandle === 'input') {
        className = 'generate-to-generate';
      }
      
      // Add execution state classes
      if (isRunning) {
        // For AI Generator to AI Generator connections - only activate when source is completed
        if (sourceNode?.type === 'generate' && targetNode?.type === 'generate' && sourceNode?.data?.executionState) {
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
    
    if (node.type === 'generate') {
      // Function to recursively find all Generate nodes in the dependency chain
      const findAllGenerateNodesInChain = (nodeId: string, visited = new Set()): any[] => {
        if (visited.has(nodeId)) return []; // Avoid infinite loops
        visited.add(nodeId);
        
        const generateNodes: any[] = [];
        
        // Find all nodes that feed into this node
        const incomingEdges = edges.filter(edge => edge.target === nodeId);
        incomingEdges.forEach(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          if (sourceNode) {
            if (sourceNode.type === 'generate') {
              // Add this Generate node
              generateNodes.push(sourceNode);
            }
            // Recursively check the source node's dependencies
            generateNodes.push(...findAllGenerateNodesInChain(sourceNode.id, visited));
          }
        });
        
        return generateNodes;
      };
      
      // Find all Generate nodes in the dependency chain
      const allGenerateNodes = findAllGenerateNodesInChain(node.id);
      
      // Remove duplicates based on node ID
      const uniqueGenerateNodes = allGenerateNodes.filter((node, index, self) => 
        index === self.findIndex(n => n.id === node.id)
      );
      
      // Add all unique Generate nodes to connectedResults
      uniqueGenerateNodes.forEach(generateNode => {
        const variableName = generateNode.data.variableName || 'AI Agent 1';
        (connectedResults as any)[variableName] = generateNode.data.result || '';
      });
    }

    // Check if this Files node is connected to an executing AI Generator
    let isConnectedToExecuting = false;
    if (node.type === 'files') {
      const outgoingEdges = edges.filter(edge => edge.source === node.id);
      isConnectedToExecuting = outgoingEdges.some(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode?.type === 'generate' && 
               targetNode.data?.executionState && 
               ['preparing', 'processing', 'completing'].includes(targetNode.data.executionState);
      });
    }
    
    return {
      ...node,
      data: {
        ...node.data,
        variables: node.type === 'generate' ? variables : undefined,
        connectedResults: node.type === 'generate' ? connectedResults : undefined,
        isConnectedToExecuting: node.type === 'files' ? isConnectedToExecuting : undefined,
        onModelChange: node.type === 'generate'
          ? (model: string) => updateNodeData(node.id, { selectedModel: model })
          : undefined,
        onVariableNameChange: node.type === 'generate'
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
        onSearchGroundingChange: node.type === 'generate'
          ? (enabled: boolean) => updateNodeData(node.id, { isSearchGroundingEnabled: enabled })
          : undefined,
        onReasoningChange: node.type === 'generate'
          ? (enabled: boolean) => updateNodeData(node.id, { isReasoningEnabled: enabled })
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
            <h1 className='font-semibold text-lg'>
              {workflowTitle || 'New Workflow'}
            </h1>
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
        >
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
                  ) : (
                    <h3 className="font-semibold text-base">
                      {editingNode.type === 'note' ? 'Note' : 
                       editingNode.type === 'files' ? 'Files' :
                       editingNode.type === 'variables' ? 'Global Variables' : 'Node'}
                    </h3>
                  )}
                  <p className='mt-1 text-muted-foreground text-xs'>
                    {editingNode.type === 'generate' ? 'Call the model with your instructions and tools' :
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
                  {/* System Prompt */}
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
                      <GlobeIcon size={14} />
                      <span className='font-medium text-muted-foreground text-xs'>Search Grounding</span>
                    </div>
                    <button
                        onClick={() => {
                          const newValue = !editingNode.data.isSearchGroundingEnabled;
                          updateNodeData(editingNode.id, { isSearchGroundingEnabled: newValue });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, isSearchGroundingEnabled: newValue }
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

                    {/* Reasoning Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BrainIcon size={14} />
                        <span className='font-medium text-muted-foreground text-xs'>Thinking Mode</span>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !editingNode.data.isReasoningEnabled;
                          updateNodeData(editingNode.id, { isReasoningEnabled: newValue });
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, isReasoningEnabled: newValue }
                          });
                        }}
                        className={`relative h-5 w-10 rounded-full border transition-colors ${
                          editingNode.data.isReasoningEnabled 
                            ? 'border-purple-500 bg-purple-500' 
                            : 'border-border bg-muted'
                        }`}
                      >
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          editingNode.data.isReasoningEnabled ? 'translate-x-5' : 'translate-x-0.5'
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
                <div className="space-y-1">
                  <Label className='font-medium text-muted-foreground text-xs'>Selected Files</Label>
                  <div className='min-h-[80px] rounded-md border border-border p-2'>
                    {editingNode.data.selectedFiles?.length > 0 ? (
                      <div className="space-y-1">
                        {editingNode.data.selectedFiles.map((file: any, index: number) => (
                          <div key={index} className='flex items-center justify-between rounded bg-muted p-2 text-xs'>
                            <span className="truncate">{file.name}</span>
                            <button
                              onClick={() => {
                                const updatedFiles = editingNode.data.selectedFiles.filter((_: any, i: number) => i !== index);
                                updateNodeData(editingNode.id, { selectedFiles: updatedFiles });
                                setEditingNode({
                                  ...editingNode,
                                  data: { ...editingNode.data, selectedFiles: updatedFiles }
                                });
                              }}
                              className='flex h-4 w-4 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600'
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs">
                        No files selected
                      </div>
                    )}
                  </div>
                </div>
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
                        <span>Search Grounding:</span>
                        <span>{editingNode.data.isSearchGroundingEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Thinking Mode:</span>
                        <span>{editingNode.data.isReasoningEnabled ? 'Enabled' : 'Disabled'}</span>
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
                    onClick={() => setVariableModal({ isOpen: true, mode: 'add' })}
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
                              onClick={() => setVariableModal({ 
                                isOpen: true, 
                                mode: 'edit', 
                                variable: variable 
                              })}
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
            onClick={() => setVariableModal({ isOpen: false, mode: 'add' })}
          />
          
          {/* Modal */}
          <div className='zoom-in-95 relative max-h-[80vh] w-96 max-w-[90vw] animate-in overflow-y-auto rounded-xl border-2 border-border/60 bg-background/95 p-6 shadow-2xl backdrop-blur-sm duration-200'>
            {/* Header */}
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='font-semibold text-lg'>
                {variableModal.mode === 'add' ? 'Add Variable' : 'Edit Variable'}
              </h3>
              <button
                onClick={() => setVariableModal({ isOpen: false, mode: 'add' })}
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
                  placeholder="Enter the value for this variable..."
                  rows={4}
                  className='w-full resize-none rounded-lg border-2 border-border/60 bg-background px-3 py-2.5 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setVariableModal({ isOpen: false, mode: 'add' })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const nameInput = document.getElementById('modal-var-name') as HTMLInputElement;
                    const valueInput = document.getElementById('modal-var-value') as HTMLTextAreaElement;
                    
                    if (nameInput?.value.trim() && valueInput?.value.trim()) {
                      if (variableModal.mode === 'add') {
                        const newVariable = {
                          id: `var-${Date.now()}`,
                          name: nameInput.value.trim(),
                          value: valueInput.value.trim(),
                        };
                        setVariables([...variables, newVariable]);
                      } else if (variableModal.variable) {
                        setVariables(variables.map(v => 
                          v.id === variableModal.variable?.id 
                            ? { ...v, name: nameInput.value.trim(), value: valueInput.value.trim() }
                            : v
                        ));
                      }
                      setVariableModal({ isOpen: false, mode: 'add' });
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
              <div className='relative h-full w-full flex'>
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
                <div className='w-80 border-l border-border p-6 pl-3'>
                  <div className='h-full flex flex-col'>
                    <h3 className='text-lg font-semibold mb-4'>Variables disponibles</h3>
                    
                    {/* Global Variables */}
                    <div className='mb-6'>
                      <h4 className='text-sm font-medium text-muted-foreground mb-2'>Variables globales</h4>
                      <div className='space-y-1'>
                        {variables.map((variable) => (
                          <div key={variable.id} className='relative group'>
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
                              className='w-full text-left p-2 rounded border border-dashed border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/30 transition-colors'
                            >
                              <div className='text-sm font-mono text-green-700 dark:text-green-300'>
                                {`{{${variable.name}}}`}
                              </div>
                              <div className='text-xs text-green-600 dark:text-green-400 truncate'>
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
                              }}
                              className='absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-200 dark:hover:bg-green-700'
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        {/* Add Global Variable Button */}
                        <button
                          onClick={() => setVariableModal({ isOpen: true, mode: 'add' })}
                          className='w-full text-left p-2 rounded border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 transition-colors flex items-center justify-center gap-2'
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          <span className='text-sm text-muted-foreground'>Ajouter dans variable globale</span>
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
                            <h4 className='text-sm font-medium text-muted-foreground mb-2'>Réponses AI Agents</h4>
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
                                  className='w-full text-left p-2 rounded border border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 transition-colors'
                                >
                                  <div className='text-sm font-mono text-blue-700 dark:text-blue-300'>
                                    {`{{${variable.name}}}`}
                                  </div>
                                  <div className='text-xs text-blue-600 dark:text-blue-400 truncate'>
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
                      <div className='text-sm text-muted-foreground text-center py-8'>
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
      </div>
    </div>
  );
}