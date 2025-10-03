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
import { VariablesPanel, type Variable } from '@/components/workflow/variables-panel';
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  
  // Connection highlighting state
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handleId: string; handleType: 'source' | 'target' } | null>(null);

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
        
        // Load the workflow data
        const workflowData = workflow.workflowData;
        
        if (workflowData && workflowData.nodes && workflowData.edges) {
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    if (showAddMenu || showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddMenu, showSettingsMenu]);

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
    setShowSettingsMenu(false);
  }, []);

  // Import workflow from JSON
  const importWorkflow = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
    
    // Reset the input value so the same file can be imported again
    event.target.value = '';
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
    },
    [setEdges]
  );

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

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    
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
            userPrompt += '\n\n' + inputNode.data.result;
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
      } else {
        updateNodeData(generateNode.id, { 
          result: 'Error: Failed to generate content', 
          isLoading: false,
          executionState: 'error'
        });
      }
    } catch (error) {
      console.error('Error processing generate node:', error);
      updateNodeData(generateNode.id, { 
        result: 'Error: Failed to generate content', 
        isLoading: false,
        executionState: 'error'
      });
    }
  };

  // Function to add appropriate CSS classes to edges based on node types
  const processEdgesWithClasses = useCallback((edgesToProcess: any[]) => {
    return edgesToProcess.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      // Add animation class for Generate to Generate connections
      if (sourceNode?.type === 'generate' && targetNode?.type === 'generate' && 
          edge.sourceHandle === 'output' && edge.targetHandle === 'input') {
        return {
          ...edge,
          className: 'generate-to-generate',
          data: {
            ...edge.data,
            sourceType: sourceNode.type,
            targetType: targetNode.type
          }
        };
      }
      
      // Keep other edges as-is but ensure data is set
      return {
        ...edge,
        data: {
          ...edge.data,
          sourceType: sourceNode?.type,
          targetType: targetNode?.type
        }
      };
    });
  }, [nodes]);

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
    
    return {
      ...node,
      data: {
        ...node.data,
        variables: node.type === 'generate' ? variables : undefined,
        connectedResults: node.type === 'generate' ? connectedResults : undefined,
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
        onDelete: () => deleteNode(node.id),
        isHandleHighlighted: (handleId: string, handleType: 'source' | 'target') => 
          isHandleHighlighted(node.id, handleId, handleType),
        connectingFrom: connectingFrom,
      }
    };
  });

  return (
    <div className='relative flex h-screen flex-col'>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-background border rounded-lg px-6 py-4 shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-sm font-medium">Chargement du workflow...</span>
          </div>
        </div>
      )}

      {/* Floating Minimal Toolbar */}
      <div className='-translate-x-1/2 absolute top-6 left-1/2 z-50 transform'>
        <div className='flex items-center gap-1 rounded-full border border-white/20 bg-background/90 p-1.5 shadow-2xl backdrop-blur-xl transition-shadow duration-300 hover:shadow-3xl'>
          {/* Library Button */}
          <Button
            variant="ghost"
            size="sm"
            className='group h-8 w-8 rounded-full p-0 transition-all duration-300 hover:scale-110 hover:bg-white/10'
            title="Workflow Library"
            onClick={() => {
              window.location.href = '/workflows-library';
            }}
          >
            <LibraryIcon size={14} />
          </Button>

          {/* Separator */}
          <div className='mx-2 h-5 w-px bg-foreground/40' />

          {/* Add Menu Button */}
          <div className="relative" ref={addMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className='group flex h-8 items-center gap-1.5 rounded-full px-3 transition-all duration-300 hover:scale-105 hover:bg-white/10'
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <PlusIcon size={14} />
              <span className='font-medium text-sm'>Add</span>
              <ChevronDownIcon size={10} />
            </Button>
            
            {/* Dropdown Menu */}
            {showAddMenu && (
              <div className='fade-in slide-in-from-top-2 absolute top-full left-0 z-20 mt-3 min-w-[180px] animate-in overflow-hidden rounded-xl border border-white/10 bg-background/80 shadow-2xl backdrop-blur-xl duration-300'>
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className='group w-full justify-start gap-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10'
                    onClick={() => {
                      addGenerateNode();
                      setShowAddMenu(false);
                    }}
                  >
                    <span className='text-lg transition-transform duration-200 group-hover:scale-110'>🤖</span>
                    <span className="font-medium">AI Generator</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className='group w-full justify-start gap-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10'
                    onClick={() => {
                      addFilesNode();
                      setShowAddMenu(false);
                    }}
                  >
                    <span className='text-lg transition-transform duration-200 group-hover:scale-110'>📁</span>
                    <span className="font-medium">Files</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className='mx-1 h-4 w-px bg-border/30' />

          {/* Variables Panel */}
          <div className="flex items-center">
            <VariablesPanel 
              variables={variables} 
              onVariablesChange={setVariables} 
            />
          </div>

          {/* Separator */}
          <div className='mx-1 h-4 w-px bg-border/30' />

          {/* Settings Menu Button */}
          <div className="relative" ref={settingsMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className='group h-8 w-8 rounded-full p-0 transition-all duration-300 hover:scale-110 hover:bg-white/10'
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Settings"
            >
              <SettingsIcon size={14} />
            </Button>
            
            {/* Settings Dropdown Menu */}
            {showSettingsMenu && (
              <div className='fade-in slide-in-from-top-2 absolute top-full right-0 z-20 mt-3 min-w-[180px] animate-in overflow-hidden rounded-xl border border-white/10 bg-background/80 shadow-2xl backdrop-blur-xl duration-300'>
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className='group w-full justify-start gap-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10'
                    onClick={openSaveModal}
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    <span className="font-medium">{currentWorkflowId ? 'Mettre à jour' : 'Sauvegarder'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className='group w-full justify-start gap-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10'
                    onClick={() => {
                      exportWorkflow();
                      setShowSettingsMenu(false);
                    }}
                  >
                    <DownloadIcon size={12} />
                    <span className="font-medium">Export JSON</span>
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        importWorkflow(e);
                        setShowSettingsMenu(false);
                      }}
                      className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
                      id="import-workflow-settings"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className='group w-full justify-start gap-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/10'
                      asChild
                    >
                      <label htmlFor="import-workflow-settings" className="cursor-pointer">
                        <UploadIcon size={12} />
                        <span className="font-medium">Import JSON</span>
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className='mx-2 h-5 w-px bg-foreground/40' />

          {/* Run Button */}
          <Button 
            onClick={handleRun} 
            disabled={isRunning}
            className='group flex h-8 items-center gap-2 rounded-full bg-blue-primary px-4 transition-all duration-300 hover:scale-105 hover:bg-blue-primary/90 disabled:opacity-50'
            style={{ backgroundColor: isRunning ? 'var(--blue-primary)' : 'var(--blue-primary)' }}
          >
            <div className={`transition-all duration-300 ${isRunning ? 'animate-spin' : 'group-hover:scale-110'}`} style={{ color: 'white' }}>
              <svg
                height={12}
                strokeLinejoin="round"
                viewBox="0 0 16 16"
                width={12}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M13.4549 7.22745L13.3229 7.16146L2.5 1.74999L2.4583 1.72914L1.80902 1.4045L1.3618 1.18089C1.19558 1.09778 1 1.21865 1 1.4045L1 1.9045L1 2.63041L1 2.67704L1 13.3229L1 13.3696L1 14.0955L1 14.5955C1 14.7813 1.19558 14.9022 1.3618 14.8191L1.80902 14.5955L2.4583 14.2708L2.5 14.25L13.3229 8.83852L13.4549 8.77253L14.2546 8.37267L14.5528 8.2236C14.737 8.13147 14.737 7.86851 14.5528 7.77638L14.2546 7.62731L13.4549 7.22745ZM11.6459 7.99999L2.5 3.42704L2.5 12.5729L11.6459 7.99999Z"
                  fill="white"
                />
              </svg>
            </div>
            <span className='font-medium text-sm text-white'>
              {isRunning ? 'Running...' : 'Run'}
            </span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          className="react-flow-custom"
          style={{
            backgroundColor: '#fafbfd'
          }}
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Controls />
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
  );
}