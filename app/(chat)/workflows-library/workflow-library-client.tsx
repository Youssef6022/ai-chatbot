'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Workflow } from '@/lib/db/schema';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Download, Trash2, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Component to handle time display without hydration issues
function TimeAgo({ date }: { date: Date }) {
  const [timeString, setTimeString] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTimeString(formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: fr 
      }));
    };
    updateTime();
    
    // Update every minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!mounted) {
    return <span>...</span>;
  }

  return <span>{timeString}</span>;
}
import { toast } from 'sonner';
import { WorkflowConsole } from '@/components/workflow/workflow-console';
import { PreRunVariablesModal } from '@/components/workflow/pre-run-variables-modal';
import JSZip from 'jszip';

interface WorkflowLibraryClientProps {
  workflows: Workflow[];
}

// Define Variable interface
interface Variable {
  id: string;
  name: string;
  value: string;
  askBeforeRun: boolean;
}

export function WorkflowLibraryClient({ workflows: initialWorkflows }: WorkflowLibraryClientProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newWorkflowTitle, setNewWorkflowTitle] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [importedWorkflowData, setImportedWorkflowData] = useState<any>(null);

  // ReactFlow state for workflow execution
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [showPreRunModal, setShowPreRunModal] = useState(false);
  const [shouldExecute, setShouldExecute] = useState(false);
  const currentVariablesRef = useRef<Variable[]>([]);
  const processingNodesRef = useRef<Set<string>>(new Set());
  const isExecutingRef = useRef(false);

  // Console state
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>>([]);
  const [currentWorkflowNodes, setCurrentWorkflowNodes] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Keep current variables ref in sync
  useEffect(() => {
    currentVariablesRef.current = variables;
  }, [variables]);

  // Function to update node data
  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    );
  }, [setNodes]);

  // Function to add execution logs
  const addExecutionLog = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string, nodeId?: string, nodeName?: string) => {
    const log = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      nodeId,
      nodeName,
      message
    };
    setExecutionLogs(prev => [...prev, log]);
  }, []);

  // Helper function to extract clean text from result
  const extractTextFromResult = (result: any): string => {
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object' && parsed.userPrompt) {
          const lines = result.split('\n');
          const nonJsonLines = [];
          for (const line of lines) {
            if (line.trim().startsWith('{"') || line.trim().startsWith('"')) {
              break;
            }
            nonJsonLines.push(line);
          }
          return nonJsonLines.join('\n').trim();
        }
        return result;
      } catch {
        return result;
      }
    } else if (result && typeof result === 'object') {
      return result.text || result.content || result.message || result.userPrompt || String(result);
    }
    return String(result || '');
  };

  // Helper function to process prompt text with variables
  const processPromptText = useCallback((text: string, latestNodes: any[]) => {
    let processedText = text;

    // Replace global variables (double braces)
    const currentVars = currentVariablesRef.current;
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
  }, [edges]);

  // Process a single generate/decision node
  const processGenerateNode = useCallback(async (generateNode: any, currentNodes: any[], inputEdge?: any, filesEdges?: any[]) => {
    try {
      const nodeName = generateNode.data.variableName || generateNode.data.label || 'AI Agent';

      // Check if node is in processing set
      if (!processingNodesRef.current.has(generateNode.id)) {
        console.log(`[processGenerateNode] Node ${generateNode.id} is NOT in processing set, aborting`);
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

        // Collect context from connected input nodes
        let connectedContext = '';
        const inputEdges = edges.filter(edge => edge.target === generateNode.id && edge.targetHandle === 'input');

        inputEdges.forEach(edge => {
          const connectedNode = latestNodes.find(node => node.id === edge.source);
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

      // Process files from connected Files nodes
      let allFiles: any[] = [];
      if (filesEdges && filesEdges.length > 0) {
        filesEdges.forEach(edge => {
          const filesNode = latestNodes.find(node => node.id === edge.source);
          if (filesNode && filesNode.type === 'files' && filesNode.data.selectedFiles) {
            const newFiles = filesNode.data.selectedFiles.filter((newFile: any) =>
              !allFiles.some(existingFile => existingFile.url === newFile.url)
            );
            allFiles = [...allFiles, ...newFiles];
          }
        });
      }

      // Call the AI API
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
          ragCorpus: generateNode.data.isRAGDroitEnabled ? 'rag-droit-francais' : 'none',
        }),
      });

      if (response.ok) {
        const result = await response.text();

        // For decision nodes, parse the response to determine the selected choice
        if (currentGenerateNode?.type === 'decision') {
          const choices = currentGenerateNode?.data?.choices || [];
          const resultTrimmed = result.trim();

          let selectedChoice: string | undefined;

          const exactMatch = choices.find((choice: string) =>
            choice.toLowerCase() === resultTrimmed.toLowerCase()
          );

          if (exactMatch) {
            selectedChoice = exactMatch;
          } else if (resultTrimmed.toLowerCase() === 'else') {
            selectedChoice = 'else';
          } else {
            const partialMatch = choices.find((choice: string) =>
              resultTrimmed.toLowerCase().includes(choice.toLowerCase())
            );

            if (partialMatch) {
              selectedChoice = partialMatch;
            } else {
              selectedChoice = 'else';
            }
          }

          updateNodeData(generateNode.id, {
            result,
            selectedChoice,
            isLoading: false,
            executionState: 'completed'
          });

          addExecutionLog('success', `Decision made: ${selectedChoice}`, generateNode.id, nodeName);
        } else {
          updateNodeData(generateNode.id, { result, isLoading: false, executionState: 'completed' });
          addExecutionLog('success', `Generation completed successfully`, generateNode.id, nodeName);
        }
      } else {
        const errorMsg = 'Error: Failed to generate content';
        updateNodeData(generateNode.id, {
          result: errorMsg,
          isLoading: false,
          executionState: 'error'
        });
        addExecutionLog('error', errorMsg, generateNode.id, nodeName);
      }
    } catch (error: any) {
      const nodeName = generateNode.data.variableName || generateNode.data.label || 'AI Agent';
      const errorMsg = `Error: ${error.message}`;
      updateNodeData(generateNode.id, {
        result: errorMsg,
        isLoading: false,
        executionState: 'error'
      });
      addExecutionLog('error', errorMsg, generateNode.id, nodeName);
    } finally {
      processingNodesRef.current.delete(generateNode.id);
    }
  }, [updateNodeData, addExecutionLog, processPromptText, edges, setNodes, extractTextFromResult]);

  // Process a node in order (wrapper that manages the processing set)
  const processGenerateNodeInOrder = useCallback(async (generateNodeId: string) => {
    // Check if already processing
    if (processingNodesRef.current.has(generateNodeId)) {
      console.log(`[processGenerateNodeInOrder] Node ${generateNodeId} is already being processed, skipping...`);
      return;
    }

    // Mark as processing immediately
    processingNodesRef.current.add(generateNodeId);

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
      processingNodesRef.current.delete(generateNodeId);
    }
  }, [setNodes, edges, processGenerateNode]);

  // Main workflow execution function
  const executeWorkflow = useCallback(async (variablesToUse?: Variable[]) => {
    // Prevent multiple simultaneous executions
    if (isExecutingRef.current) {
      console.log('[executeWorkflow] Already executing, skipping...');
      return;
    }

    isExecutingRef.current = true;

    // Use provided variables or current variables
    if (variablesToUse) {
      setVariables(variablesToUse);
      currentVariablesRef.current = variablesToUse;
    }

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

      toast.error(`Cannot run workflow: The following node(s) are missing prompts/instructions: ${nodeNames}`);
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

      const processNodeAndDescendants = async (nodeId: string): Promise<void> => {
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
              allInputsReady = false;
              break;
            }
          }

          if (!allInputsReady) {
            return; // Skip this node for now
          }
        }

        // Avoid processing the same node twice
        if (processedNodes.has(nodeId)) {
          return;
        }
        processedNodes.add(nodeId);

        // Files nodes don't need execution
        if (currentNodeState.type === 'files') {
          // Continue to descendants without executing
        } else if (currentNodeState.type === 'generate' || currentNodeState.type === 'decision') {
          // Execute the current node
          await processGenerateNodeInOrder(nodeId);
        } else {
          return;
        }

        // Get the updated node state after execution
        const updatedNodeState = await new Promise<any>(resolve => {
          setNodes(currentNodes => {
            const node = currentNodes.find(n => n.id === nodeId);
            resolve(node);
            return currentNodes;
          });
        });

        // Find all outgoing edges
        const outgoingEdges = edges.filter(edge => edge.source === nodeId);

        // If this is a decision node, only follow the edge matching the selected choice
        if (updatedNodeState?.type === 'decision' && updatedNodeState.data?.selectedChoice) {
          const selectedChoice = updatedNodeState.data.selectedChoice;

          let matchingEdge;
          if (selectedChoice === 'else') {
            matchingEdge = outgoingEdges.find(edge => edge.sourceHandle === 'else');
          } else {
            const choices = updatedNodeState.data.choices || [];
            const choiceIndex = choices.findIndex((c: string) => c === selectedChoice);
            if (choiceIndex !== -1) {
              matchingEdge = outgoingEdges.find(edge => edge.sourceHandle === `choice-${choiceIndex}`);
            }
          }

          if (matchingEdge) {
            await processNodeAndDescendants(matchingEdge.target);
          }
        } else if (updatedNodeState?.type === 'files') {
          // For files nodes, follow all outgoing edges
          for (const edge of outgoingEdges) {
            await processNodeAndDescendants(edge.target);
          }
        } else {
          // For generate nodes, follow all outgoing edges from 'output' handle
          for (const edge of outgoingEdges) {
            if (updatedNodeState?.type === 'generate' && edge.sourceHandle === 'output') {
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
      isExecutingRef.current = false;
      processingNodesRef.current.clear();
    }
  }, [nodes, edges, setNodes, updateNodeData, addExecutionLog, processGenerateNodeInOrder]);

  // Effect to execute workflow once nodes are loaded
  useEffect(() => {
    if (shouldExecute && nodes.length > 0) {
      setShouldExecute(false);

      // Check if there are any variables that need to be asked before run
      const variablesToAsk = variables.filter(v => v.askBeforeRun);

      // Check if there are any files nodes that need to be asked before run
      const filesNodesToAsk = nodes.filter(node =>
        node.type === 'files' && node.data.askBeforeRun
      );

      if (variablesToAsk.length > 0 || filesNodesToAsk.length > 0) {
        setShowPreRunModal(true);
      } else {
        executeWorkflow();
      }
    }
  }, [shouldExecute, nodes, variables, executeWorkflow]);

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
    // Execute workflow immediately with the updated variables
    executeWorkflow(updatedVariables);
  }, [executeWorkflow, nodes, setNodes]);

  // Function to download results as ZIP
  const downloadResults = useCallback(async () => {
    // Get all generate nodes with results
    const generateNodes = nodes.filter(node => node.type === 'generate' && node.data.result);

    if (generateNodes.length === 0) {
      toast.error('Aucun résultat de génération à télécharger');
      return;
    }

    // Create ZIP file
    const zip = new JSZip();

    generateNodes.forEach((node, index) => {
      const nodeName = node.data.variableName || node.data.label || `AIGenerator${index + 1}`;
      // Clean filename (remove special characters)
      const cleanFileName = nodeName.replace(/[^a-zA-Z0-9]/g, '');

      // Create markdown content for this specific AI generator
      let markdownContent = `# ${nodeName}\n\n`;
      markdownContent += `Generated on: ${new Date().toLocaleString()}\n\n`;

      if (node.data.systemPrompt) {
        markdownContent += `## System Prompt\n\n${node.data.systemPrompt}\n\n`;
      }

      if (node.data.userPrompt) {
        markdownContent += `## User Prompt\n\n${node.data.userPrompt}\n\n`;
      }

      markdownContent += `## Generated Result\n\n${node.data.result}\n\n`;

      // Add configuration info
      markdownContent += `## Configuration\n\n`;
      markdownContent += `- Model: ${node.data.selectedModel || 'chat-model-medium'}\n`;
      markdownContent += `- Search Grounding: ${node.data.isSearchGroundingEnabled ? 'Enabled' : 'Disabled'}\n`;
      markdownContent += `- Maps Grounding: ${node.data.isMapsGroundingEnabled ? 'Enabled' : 'Disabled'}\n`;
      markdownContent += `- RAG (Codes Droit FR): ${node.data.isRAGDroitEnabled ? 'Enabled' : 'Disabled'}\n`;

      // Add to ZIP
      zip.file(`${cleanFileName}.md`, markdownContent);
    });

    // Generate and download ZIP
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workflow-results-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Résultats téléchargés avec succès');
    } catch (error) {
      toast.error('Erreur lors de la création du fichier ZIP');
    }
  }, [nodes]);

  // Function to run workflow from library
  const handleRunWorkflow = useCallback((workflow: Workflow) => {
    if (isRunning) return;

    try {
      const workflowData = workflow.workflowData;

      if (!workflowData || !workflowData.nodes) {
        toast.error('Données de workflow invalides');
        return;
      }

      // Load workflow data into ReactFlow state
      const loadedNodes = workflowData.nodes || [];
      const loadedEdges = workflowData.edges || [];
      const loadedVariables = workflowData.variables || [];

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setVariables(loadedVariables);
      setCurrentWorkflowNodes(loadedNodes);

      // Trigger execution via effect
      setShouldExecute(true);

    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  }, [isRunning, setNodes, setEdges]);

  const handleDelete = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkflows(workflows.filter(w => w.id !== workflowId));
        toast.success('Workflow supprimé avec succès');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownload = (workflow: Workflow) => {
    const dataStr = JSON.stringify(workflow.workflowData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `${workflow.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLoadToWorkflow = (workflow: Workflow) => {
    // Rediriger vers la page workflows avec l'ID du workflow
    window.location.href = `/workflows?id=${workflow.id}`;
  };

  const handleCreateWorkflow = () => {
    if (!newWorkflowTitle.trim()) {
      toast.error('Le titre du workflow est requis');
      return;
    }

    // Rediriger vers la page workflows avec les données du nouveau workflow
    const params = new URLSearchParams({
      title: newWorkflowTitle,
      description: newWorkflowDescription
    });
    window.location.href = `/workflows?${params.toString()}`;
  };

  const handleImportWorkflow = () => {
    if (!newWorkflowTitle.trim()) {
      toast.error('Le titre du workflow est requis');
      return;
    }

    if (!importedWorkflowData) {
      toast.error('Aucun workflow à importer');
      return;
    }

    // Rediriger vers la page workflows avec les données du workflow importé et le nouveau nom/description
    const params = new URLSearchParams({
      import: JSON.stringify(importedWorkflowData),
      title: newWorkflowTitle,
      description: newWorkflowDescription
    });
    window.location.href = `/workflows?${params.toString()}`;
  };

  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string);
        setImportedWorkflowData(workflowData);
        
        // Pré-remplir avec le nom existant s'il existe
        const existingName = workflowData.metadata?.name || 'Workflow Importé';
        setNewWorkflowTitle(existingName);
        setNewWorkflowDescription('');
        
        setShowImportModal(true);
      } catch (error) {
        toast.error('Erreur lors de la lecture du fichier JSON');
      }
    };
    reader.readAsText(file);
  };


  return (
    <>
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className='mb-6 font-bold text-3xl text-foreground'>Create Workflow</h1>
        <p className="mx-auto mb-10 max-w-lg text-muted-foreground leading-relaxed">
          Design intelligent chat workflows with AI nodes, custom logic, and powerful automation tools. Transform conversations into seamless experiences.
        </p>
        
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-sm text-white shadow-md transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg'
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New
          </button>
          
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  handleFileImport(file);
                }
              };
              input.click();
            }}
            className='inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-transparent px-6 py-3 font-medium text-blue-600 text-sm transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/20'
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import Existing
          </button>
        </div>
      </div>

      {/* Workflows Section */}
      {workflows.length > 0 && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className='font-semibold text-foreground text-xl'>Your Workflows</h2>
              <div className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 text-xs dark:bg-blue-900/30 dark:text-blue-400'>
                {workflows.length}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md dark:hover:border-blue-800"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className='mb-1 truncate font-medium text-foreground text-sm'>
                      {workflow.title}
                    </h3>
                    <p className='line-clamp-2 text-muted-foreground text-xs'>
                      {workflow.description || 'No description provided'}
                    </p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem onClick={() => handleLoadToWorkflow(workflow)} className="cursor-pointer text-xs">
                        <Play className="mr-2 h-3 w-3" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(workflow)} className="cursor-pointer text-xs">
                        <Download className="mr-2 h-3 w-3" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(workflow.id)}
                        className='cursor-pointer text-destructive text-xs'
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Actions */}
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => handleRunWorkflow(workflow)}
                    disabled={isRunning}
                    className='flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 font-medium text-white text-xs transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4z" />
                    </svg>
                    Run
                  </button>
                  <button
                    onClick={() => handleLoadToWorkflow(workflow)}
                    className='flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 font-medium text-white text-xs transition-all hover:bg-blue-700'
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <TimeAgo date={new Date(workflow.createdAt)} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de création de workflow */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouveau workflow</DialogTitle>
            <DialogDescription>
              Donnez un titre et une description à votre nouveau workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                placeholder="Mon nouveau workflow"
                value={newWorkflowTitle}
                onChange={(e) => setNewWorkflowTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleCreateWorkflow();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                placeholder="Description de votre workflow..."
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateModal(false);
                setNewWorkflowTitle('');
                setNewWorkflowDescription('');
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateWorkflow}>
              Créer le workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'import de workflow */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer un workflow</DialogTitle>
            <DialogDescription>
              Donnez un nom et une description à votre workflow importé.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="import-title">Titre</Label>
              <Input
                id="import-title"
                placeholder="Mon workflow importé"
                value={newWorkflowTitle}
                onChange={(e) => setNewWorkflowTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleImportWorkflow();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-description">Description (optionnel)</Label>
              <Textarea
                id="import-description"
                placeholder="Description de votre workflow importé..."
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImportModal(false);
                setNewWorkflowTitle('');
                setNewWorkflowDescription('');
                setImportedWorkflowData(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleImportWorkflow}>
              Importer le workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Run Variables Modal */}
      <PreRunVariablesModal
        isOpen={showPreRunModal}
        onClose={() => setShowPreRunModal(false)}
        variables={variables}
        filesNodes={nodes.filter(node => node.type === 'files' && node.data.askBeforeRun).map(node => ({
          id: node.id,
          variableName: node.data.variableName || node.data.label || 'Files',
          description: node.data.description,
          selectedFiles: node.data.selectedFiles || []
        }))}
        onConfirm={handlePreRunConfirm}
      />

      {/* Workflow Console - positioned on page instead of sidebar */}
      <div className={`-translate-x-1/2 fixed bottom-4 left-1/2 z-50 transform transition-all duration-500 ease-out ${
        isConsoleOpen ? 'h-80 w-[400px]' : 'h-12 w-36'
      }`}>
        <WorkflowConsole
          isOpen={isConsoleOpen}
          onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
          executionLogs={executionLogs}
          variables={variables}
          nodes={nodes}
        />
      </div>
    </>
  );
}