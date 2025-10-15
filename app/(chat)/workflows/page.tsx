'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
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
import { VariablesPanel, type Variable } from '@/components/workflow/variables-panel';
import { WorkflowConsole } from '@/components/workflow/workflow-console';
import { PlusIcon, DownloadIcon, UploadIcon, LibraryIcon, ChevronDownIcon } from '@/components/icons';
import { toast } from 'sonner';

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
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
  const [consoleTab, setConsoleTab] = useState<'edit' | 'results'>('edit');
  
  // Edit panel state
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  
  // Toolbar state
  const [selectedTool, setSelectedTool] = useState<'select' | 'move'>('select');
  const [undoHistory, setUndoHistory] = useState<any[]>([]);
  const [redoHistory, setRedoHistory] = useState<any[]>([]);
  const [executionLogs, setExecutionLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>>([]);
  

  // Track theme for dots color
  const [dotsColor, setDotsColor] = useState('#e2e8f0');

  // Load workflow from database when URL has ID parameter
  useEffect(() => {
    const workflowId = searchParams.get('id');
    if (workflowId && workflowId !== currentWorkflowId) {
      loadWorkflowFromDatabase(workflowId);
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

        console.log('Workflow importé avec succès:', workflowData.metadata);
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'import du fichier. Veuillez vérifier le format JSON.');
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges]);

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
      
      setEdges((eds) => {
        // Identifier les types de connexions
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        
        if (!sourceNode || !targetNode) return eds;
        
        // Cas 1: Generate → Generate (chaînage via input)
        if (sourceNode.type === 'generate' && targetNode.type === 'generate' && 
            params.sourceHandle === 'output' && params.targetHandle === 'input') {
          // Supprimer toute connexion existante vers le même handle du même nœud Generate
          const edgesWithoutTargetConnection = eds.filter(edge => 
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
          return addEdge(newEdge, edgesWithoutTargetConnection);
        }
        
        // Cas 2: Files → Generate (connexions de fichiers)
        if (sourceNode.type === 'files' && targetNode.type === 'generate' && 
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
          return addEdge(newEdge, eds);
        }
        
        // Rejeter les connexions non valides
        return eds;
      });
    },
    [setEdges, nodes]
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
    setEdges((eds) => eds.filter(edge => edge.id !== edgeId));
    setSelectedEdge(null);
  }, [setEdges]);

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
    setEditingNode(node);
    setIsEditPanelOpen(true);
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
    setNodes((nds) => nds.filter(node => node.id !== nodeId));
    setEdges((eds) => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

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
        onModelChange: () => {},
        onVariableNameChange: () => {},
        onSystemPromptChange: () => {},
        onUserPromptChange: () => {},
        onDelete: () => {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, nodes]);

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
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

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
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    
    // Switch to results tab and open console
    setConsoleTab('results');
    setIsConsoleOpen(true);
    
    // Clear previous logs
    setExecutionLogs([]);
    
    // Add initial log
    addExecutionLog('info', 'Workflow execution started...');
    
    try {
      // First, clear all previous results from Generate nodes before starting
      const generateNodes = nodes.filter(node => node.type === 'generate');
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
  }, [nodes, updateNodeData, setNodes]);
  
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
        processedText = processedText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), connectedGenerateNode.data.result);
      }
    });
    
    return processedText;
  };
  
  const getExecutionOrder = () => {
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
      
      // If there's an input connection from another Generate node, use its result as user prompt
      if (inputEdge) {
        const inputNode = latestNodes.find(node => node.id === inputEdge.source);
        if (inputNode && inputNode.type === 'generate' && inputNode.data.result && 
            inputNode.data.result.trim() !== '' && 
            inputNode.data.result !== 'Generating...' &&
            !(inputNode.data as any).isLoading) {
          // If user prompt is empty, use the connected result as user prompt
          // If user prompt exists, append the connected result
          if (!userPrompt.trim()) {
            userPrompt = inputNode.data.result;
          } else {
            userPrompt += `\n\n${inputNode.data.result}`;
          }
        }
      }
      
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

  // Update edges with proper classes whenever nodes or edges change
  useEffect(() => {
    setEdges(currentEdges => processEdgesWithClasses(currentEdges));
  }, [nodes, processEdgesWithClasses]);

  // Update nodes with callback functions and variables
  const nodesWithCallbacks = nodes.map(node => {
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
  });

  return (
    <div className='fixed inset-0 z-50 bg-background'>
      {/* Header with back arrow and title */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-3'>
          <Button
            variant="ghost"
            size="sm"
            className='h-8 w-8 p-0'
            onClick={() => window.history.back()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Button>
          <h1 className='font-semibold text-lg'>
            {workflowTitle || 'New Workflow'}
          </h1>
        </div>

        <div className='flex items-center gap-2'>
          {/* Variables Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className='flex items-center gap-2'
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
            </svg>
            Variables
          </Button>

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('import-file')?.click()}
            className='flex items-center gap-2'
          >
            <UploadIcon size={14} />
            Import
          </Button>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportWorkflow()}
            className='flex items-center gap-2'
          >
            <DownloadIcon size={14} />
            Export
          </Button>

          {/* Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            className='flex items-center gap-2'
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
            {currentWorkflowId ? 'Update' : 'Save'}
          </Button>

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            size="sm"
            className='flex items-center gap-2 bg-green-600 hover:bg-green-700'
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
      
      <div className='h-[calc(100vh-60px)] relative'>
      
      {/* Hidden file input for import */}
      <input
        id="import-file"
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            importWorkflow(file);
          }
        }}
      />

      {/* Floating Node Palette - Always Visible */}
      <div className="fixed top-20 left-4 z-50 bg-background/50 backdrop-blur-sm border-2 border-border/60 rounded-xl shadow-sm p-4 min-w-[160px]">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wider">Core</div>
            <div className="space-y-2">
              <button
                onClick={addGenerateNode}
                className="group w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 text-sm transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md"
              >
                <div className="w-6 h-6 bg-yellow-100 dark:bg-yellow-200 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-gray-700 dark:text-gray-800">
                    <path fill="currentColor" d="M18.5 10.255q0 .067-.003.133A1.54 1.54 0 0 0 17.473 10q-.243 0-.473.074V5.75a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75v4.505c0 .414.336.75.75.75h8.276l-.01.025l-.003.012l-.45 1.384l-.01.026l-.019.053H7.75a2.25 2.25 0 0 1-2.25-2.25V5.75A2.25 2.25 0 0 1 7.75 3.5h3.5v-.75a.75.75 0 0 1 .649-.743L12 2a.75.75 0 0 1 .743.649l.007.101l-.001.75h3.5a2.25 2.25 0 0 1 2.25 2.25zm-5.457 3.781l.112-.036H6.254a2.25 2.25 0 0 0-2.25 2.25v.907a3.75 3.75 0 0 0 1.305 2.844c1.563 1.343 3.802 2 6.691 2c2.076 0 3.817-.339 5.213-1.028a1.55 1.55 0 0 1-1.169-1.003l-.004-.012l-.03-.093c-1.086.422-2.42.636-4.01.636c-2.559 0-4.455-.556-5.713-1.638a2.25 2.25 0 0 1-.783-1.706v-.907a.75.75 0 0 1 .75-.75H12v-.003a1.54 1.54 0 0 1 1.031-1.456zM10.999 7.75a1.25 1.25 0 1 0-2.499 0a1.25 1.25 0 0 0 2.499 0m3.243-1.25a1.25 1.25 0 1 1 0 2.499a1.25 1.25 0 0 1 0-2.499m1.847 10.912a2.83 2.83 0 0 0-1.348-.955l-1.377-.448a.544.544 0 0 1 0-1.025l1.377-.448a2.84 2.84 0 0 0 1.76-1.762l.01-.034l.449-1.377a.544.544 0 0 1 1.026 0l.448 1.377a2.84 2.84 0 0 0 1.798 1.796l1.378.448l.027.007a.544.544 0 0 1 0 1.025l-1.378.448a2.84 2.84 0 0 0-1.798 1.796l-.447 1.377a.55.55 0 0 1-.2.263a.544.544 0 0 1-.827-.263l-.448-1.377a2.8 2.8 0 0 0-.45-.848m7.694 3.801l-.765-.248a1.58 1.58 0 0 1-.999-.998l-.249-.765a.302.302 0 0 0-.57 0l-.249.764a1.58 1.58 0 0 1-.983.999l-.766.248a.302.302 0 0 0 0 .57l.766.249a1.58 1.58 0 0 1 .999 1.002l.248.764a.303.303 0 0 0 .57 0l.25-.764a1.58 1.58 0 0 1 .998-.999l.766-.248a.302.302 0 0 0 0-.57z"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">AI Generator</span>
              </button>
              
              <button
                onClick={addNoteNode}
                className="group w-full flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 text-sm transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md"
              >
                <div className="w-6 h-6 bg-yellow-100 dark:bg-yellow-200 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-gray-700 dark:text-gray-800">
                    <path fill="currentColor" d="M3 17.75A3.25 3.25 0 0 0 6.25 21h4.915l.356-1.423l.02-.077H6.25a1.75 1.75 0 0 1-1.75-1.75V11h3.25l.184-.005A3.25 3.25 0 0 0 11 7.75V4.5h6.75c.966 0 1.75.784 1.75 1.75v4.982c.479-.19.994-.263 1.5-.22V6.25A3.25 3.25 0 0 0 17.75 3h-6.879a2.25 2.25 0 0 0-1.59.659L3.658 9.28A2.25 2.25 0 0 0 3 10.871zM7.75 9.5H5.561L9.5 5.561V7.75l-.006.144A1.75 1.75 0 0 1 7.75 9.5m11.35 3.17l-5.903 5.902a2.7 2.7 0 0 0-.706 1.247l-.458 1.831a1.087 1.087 0 0 0 1.319 1.318l1.83-.457a2.7 2.7 0 0 0 1.248-.707l5.902-5.902A2.286 2.286 0 0 0 19.1 12.67"/>
                  </svg>
                </div>
                <span className="font-medium text-foreground">Note</span>
              </button>
            </div>
          </div>

          <div className="border-t border-border/40 pt-3">
            <div className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wider">Tools</div>
            <div className="space-y-2">
              <button
                onClick={addFilesNode}
                className="group w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-transparent hover:border-orange-200 dark:hover:border-orange-800 text-sm transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md"
              >
                <div className="w-6 h-6 bg-yellow-100 dark:bg-yellow-200 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-800">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10,9 9,9 8,9"></polyline>
                  </svg>
                </div>
                <span className="font-medium text-foreground">Files</span>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="w-full h-full relative">
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
        <div className="fixed top-20 right-4 z-50 bg-background/50 backdrop-blur-sm border-2 border-border/60 rounded-xl shadow-sm p-4 w-80 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="mb-4">
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
                    className="font-semibold text-base bg-transparent border-none outline-none w-full group-hover:bg-muted/30 focus:bg-muted/30 rounded px-1 py-0.5 pr-6 transition-colors"
                  />
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors pointer-events-none"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </div>
              ) : (
                <h3 className="font-semibold text-base">
                  {editingNode.type === 'note' ? 'Note' : 
                   editingNode.type === 'files' ? 'Files' : 'Node'}
                </h3>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {editingNode.type === 'generate' ? 'Call the model with your instructions and tools' :
                 editingNode.type === 'note' ? 'Add notes and documentation' :
                 editingNode.type === 'files' ? 'Select and manage files' : 'Configure this node'}
              </p>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {editingNode.type === 'generate' && (
                <>
                  {/* User Prompt */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">User Prompt</Label>
                    <Textarea
                      value={editingNode.data.userPrompt || ''}
                      onChange={(e) => {
                        updateNodeData(editingNode.id, { userPrompt: e.target.value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, userPrompt: e.target.value }
                        });
                      }}
                      placeholder="Enter your prompt..."
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>

                  {/* Instructions */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground">Instructions</Label>
                      <div className="flex items-center gap-1">
                        <button className="w-5 h-5 rounded bg-muted hover:bg-muted/80 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                        <button className="w-5 h-5 rounded bg-muted hover:bg-muted/80 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <Textarea
                      value={editingNode.data.systemPrompt || ''}
                      onChange={(e) => {
                        updateNodeData(editingNode.id, { systemPrompt: e.target.value });
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, systemPrompt: e.target.value }
                        });
                      }}
                      placeholder="You are a helpful assistant."
                      className="min-h-[80px] resize-none text-sm"
                    />
                  </div>

                  {/* Model Selection - Label and custom dropdown */}
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Model</Label>
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
                        className="appearance-none bg-transparent text-sm text-foreground pr-6 cursor-pointer focus:outline-none"
                      >
                        <option value="chat-model-small">Small</option>
                        <option value="chat-model-medium">Medium</option>
                        <option value="chat-model-large">Large</option>
                      </select>
                      <svg 
                        width="12" 
                        height="12" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none"
                      >
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>
                </>
              )}

              {editingNode.type === 'note' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Note Content</Label>
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
                  <Label className="text-xs font-medium text-muted-foreground">Selected Files</Label>
                  <div className="border border-border rounded-md p-2 min-h-[80px]">
                    {editingNode.data.selectedFiles?.length > 0 ? (
                      <div className="space-y-1">
                        {editingNode.data.selectedFiles.map((file: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
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
                              className="w-4 h-4 rounded bg-red-500 text-white hover:bg-red-600 flex items-center justify-center"
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
            </div>
          </div>
      )}

      {/* Floating Toolbar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-1 bg-background/50 backdrop-blur-sm border-2 border-border/60 rounded-full p-2 shadow-sm">
        {/* Select Tool */}
        <button
          onClick={() => setSelectedTool('select')}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
            selectedTool === 'select' 
              ? 'bg-background text-foreground border border-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
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
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
            selectedTool === 'move' 
              ? 'bg-background text-foreground border border-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
          }`}
          title="Move"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
          </svg>
        </button>

        {/* Undo Tool */}
        <button
          onClick={() => {
            // TODO: Implement undo functionality
            console.log('Undo clicked');
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/20 transition-all duration-200"
          title="Undo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>

        {/* Redo Tool */}
        <button
          onClick={() => {
            // TODO: Implement redo functionality
            console.log('Redo clicked');
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/20 transition-all duration-200"
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
        selectedNode={selectedNode}
        activeTab={consoleTab}
        onTabChange={setConsoleTab}
        executionLogs={executionLogs}
        variables={variables}
        onNodeUpdate={updateNodeData}
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
      </div>
    </div>
  );
}