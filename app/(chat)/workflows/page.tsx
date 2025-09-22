'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './workflow-styles.css';

import { Button } from '@/components/ui/button';
import { PromptNode } from '@/components/workflow/prompt-node';
import { GenerateNode } from '@/components/workflow/generate-node';
import { VariablesPanel, type Variable } from '@/components/workflow/variables-panel';
import { PlayIcon, PlusIcon, DownloadIcon, UploadIcon, LibraryIcon, ChevronDownIcon } from '@/components/icons';

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
  prompt: PromptNode,
  generate: GenerateNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'prompt',
    position: { x: 100, y: 100 },
    data: { 
      label: 'Text Input',
      text: 'Write a short story about...',
      onTextChange: () => {},
      onDelete: () => {},
    },
  },
  {
    id: '2',
    type: 'generate',
    position: { x: 400, y: 100 },
    data: { 
      label: 'Generate Text',
      selectedModel: 'chat-model-medium',
      result: '',
      variableName: 'result_1',
      onModelChange: () => {},
      onVariableNameChange: () => {},
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
  const addMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

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

  // Export workflow to JSON
  const exportWorkflow = useCallback(() => {
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
  }, [nodes, edges, variables]);

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

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        // Identifier les types de connexions
        const sourceNode = nodes.find(n => n.id === params.source);
        const targetNode = nodes.find(n => n.id === params.target);
        
        if (!sourceNode || !targetNode) return eds;
        
        // Cas 1: Prompt → Generate (un prompt peut avoir plusieurs sorties vers différents Generate)
        if (sourceNode.type === 'prompt' && targetNode.type === 'generate' && params.sourceHandle === 'output' && params.targetHandle === 'input') {
          // Supprimer toute connexion existante vers la même cible Generate (un Generate ne peut avoir qu'une entrée)
          const edgesWithoutTargetConnection = eds.filter(edge => 
            !(edge.target === params.target && edge.targetHandle === params.targetHandle)
          );
          return addEdge(params, edgesWithoutTargetConnection);
        }
        
        // Cas 2: Generate → Prompt (un Generate peut avoir qu'une sortie, un Prompt peut avoir plusieurs entrées)
        if (sourceNode.type === 'generate' && targetNode.type === 'prompt' && params.sourceHandle === 'output' && params.targetHandle === 'input') {
          // Supprimer toute connexion existante depuis la même source Generate (un Generate ne peut avoir qu'une sortie)
          const edgesWithoutSourceConnection = eds.filter(edge => 
            !(edge.source === params.source && edge.sourceHandle === params.sourceHandle)
          );
          return addEdge(params, edgesWithoutSourceConnection);
        }
        
        // Rejeter les connexions non valides
        return eds;
      });
    },
    [setEdges, nodes]
  );

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

  const addPromptNode = useCallback(() => {
    const newNode = {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: {
        label: 'Text Input',
        text: '',
        variables,
        onTextChange: () => {},
        onDelete: () => {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, variables]);

  const addGenerateNode = useCallback(() => {
    // Generate a unique variable name based on existing Generate nodes
    const generateNodes = nodes.filter(node => node.type === 'generate');
    const nextNumber = generateNodes.length + 1;
    
    const newNode = {
      id: `generate-${Date.now()}`,
      type: 'generate',
      position: { x: Math.random() * 300 + 400, y: Math.random() * 300 },
      data: {
        label: 'Generate Text',
        selectedModel: 'chat-model-medium',
        result: '',
        variableName: `result_${nextNumber}`,
        onModelChange: () => {},
        onVariableNameChange: () => {},
        onDelete: () => {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, nodes]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    
    try {
      // Find prompt nodes and their connected generate nodes
      const promptNodes = nodes.filter(node => node.type === 'prompt');
      
      for (const promptNode of promptNodes) {
        // Find connected generate nodes
        const connectedEdges = edges.filter(edge => edge.source === promptNode.id);
        
        for (const edge of connectedEdges) {
          const generateNode = nodes.find(node => node.id === edge.target && node.type === 'generate');
          
          if (generateNode && promptNode.data.text) {
            // Clear previous result
            updateNodeData(generateNode.id, { result: 'Generating...', isLoading: true });
            
            // Replace variables in prompt text (global variables + connected results)
            let processedPrompt = promptNode.data.text;
            
            // Replace global variables
            variables.forEach(variable => {
              const placeholder = `{${variable.name}}`;
              processedPrompt = processedPrompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), variable.value);
            });
            
            // Replace connected Generate results
            const connectedGenerateEdges = edges.filter(edge => edge.target === promptNode.id && edge.targetHandle === 'input');
            connectedGenerateEdges.forEach(edge => {
              const connectedGenerateNode = nodes.find(node => node.id === edge.source && node.type === 'generate');
              if (connectedGenerateNode?.data.result) {
                const variableName = connectedGenerateNode.data.variableName || 'result_1';
                const placeholder = `{${variableName}}`;
                processedPrompt = processedPrompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), connectedGenerateNode.data.result);
              }
            });
            
            // Call the AI API
            const response = await fetch('/api/workflow/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: processedPrompt,
                model: generateNode.data.selectedModel,
              }),
            });
            
            if (response.ok) {
              const result = await response.text();
              updateNodeData(generateNode.id, { result, isLoading: false });
            } else {
              updateNodeData(generateNode.id, { 
                result: 'Error: Failed to generate content', 
                isLoading: false 
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, updateNodeData, variables]);

  // Update nodes with callback functions and variables
  const nodesWithCallbacks = nodes.map(node => {
    const connectedResults = {};
    
    if (node.type === 'prompt') {
      // Find connected Generate nodes for this Prompt
      const incomingEdges = edges.filter(edge => edge.target === node.id && edge.targetHandle === 'input');
      incomingEdges.forEach(edge => {
        const connectedGenerateNode = nodes.find(n => n.id === edge.source && n.type === 'generate');
        if (connectedGenerateNode?.data.result) {
          const variableName = connectedGenerateNode.data.variableName || 'result_1';
          connectedResults[variableName] = connectedGenerateNode.data.result;
        }
      });
    }
    
    return {
      ...node,
      data: {
        ...node.data,
        variables: node.type === 'prompt' ? variables : undefined,
        connectedResults: node.type === 'prompt' ? connectedResults : undefined,
        onTextChange: node.type === 'prompt' 
          ? (text: string) => updateNodeData(node.id, { text })
          : undefined,
        onModelChange: node.type === 'generate'
          ? (model: string) => updateNodeData(node.id, { selectedModel: model })
          : undefined,
        onVariableNameChange: node.type === 'generate'
          ? (name: string) => updateNodeData(node.id, { variableName: name })
          : undefined,
        onDelete: () => deleteNode(node.id),
      }
    };
  });

  return (
    <div className='h-screen flex flex-col relative'>
      {/* Floating Minimal Toolbar */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 p-1.5 bg-background/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl hover:shadow-3xl transition-shadow duration-300">
          {/* Library Button */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 w-8 p-0 hover:bg-white/10 hover:scale-110 transition-all duration-300 group"
            title="Workflow Library"
            onClick={() => {
              alert('Workflow Library - Coming Soon!');
            }}
          >
            <LibraryIcon size={14} className="group-hover:scale-110 transition-transform duration-300" />
          </Button>

          {/* Separator */}
          <div className="w-px h-5 bg-foreground/40 mx-2" />

          {/* Add Menu Button */}
          <div className="relative" ref={addMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 px-3 hover:bg-white/10 hover:scale-105 transition-all duration-300 flex items-center gap-1.5 group"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <PlusIcon size={14} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm font-medium">Add</span>
              <ChevronDownIcon size={10} className={`transition-all duration-300 ${showAddMenu ? 'rotate-180 scale-110' : 'group-hover:scale-110'}`} />
            </Button>
            
            {/* Dropdown Menu */}
            {showAddMenu && (
              <div className="absolute top-full mt-3 left-0 bg-background/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl min-w-[180px] overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-3 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 group"
                    onClick={() => {
                      addPromptNode();
                      setShowAddMenu(false);
                    }}
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform duration-200">📝</span>
                    <span className="font-medium">Prompt</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-3 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 group"
                    onClick={() => {
                      addGenerateNode();
                      setShowAddMenu(false);
                    }}
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform duration-200">🤖</span>
                    <span className="font-medium">AI Generator</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-border/30 mx-1" />

          {/* Variables Panel */}
          <div className="flex items-center">
            <VariablesPanel 
              variables={variables} 
              onVariablesChange={setVariables} 
            />
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-border/30 mx-1" />

          {/* Settings Menu Button */}
          <div className="relative" ref={settingsMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 w-8 p-0 hover:bg-white/10 hover:scale-110 transition-all duration-300 group"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Settings"
            >
              <SettingsIcon size={14} className="group-hover:rotate-90 transition-transform duration-300" />
            </Button>
            
            {/* Settings Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute top-full mt-3 right-0 bg-background/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl min-w-[180px] overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-3 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 group"
                    onClick={() => {
                      exportWorkflow();
                      setShowSettingsMenu(false);
                    }}
                  >
                    <DownloadIcon size={12} className="group-hover:scale-110 group-hover:-translate-y-0.5 transition-all duration-300" />
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
                      className="w-full justify-start gap-3 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 group"
                      asChild
                    >
                      <label htmlFor="import-workflow-settings" className="cursor-pointer">
                        <UploadIcon size={12} className="group-hover:scale-110 group-hover:translate-y-0.5 transition-all duration-300" />
                        <span className="font-medium">Import JSON</span>
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-foreground/40 mx-2" />

          {/* Run Button */}
          <Button 
            onClick={handleRun} 
            disabled={isRunning}
            className="rounded-full h-8 px-4 bg-blue-primary hover:bg-blue-primary/90 hover:scale-105 transition-all duration-300 flex items-center gap-2 group disabled:opacity-50"
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
            <span className="text-sm font-medium text-white">
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
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}