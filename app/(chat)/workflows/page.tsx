'use client';

import { useCallback, useState } from 'react';
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
import { PlayIcon, PlusIcon, DownloadIcon, UploadIcon } from '@/components/icons';

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
    <div className='flex h-screen flex-col'>
      {/* Toolbar */}
      <div className='flex items-center gap-2 border-b bg-background p-4'>
        <Button
          onClick={addPromptNode}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusIcon size={14} />
          📝 Text Input
        </Button>
        <Button
          onClick={addGenerateNode}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusIcon size={14} />
          🤖 Generate Text
        </Button>
        <div className='mx-2 h-6 border-l' />
        <VariablesPanel 
          variables={variables} 
          onVariablesChange={setVariables} 
        />
        <div className='mx-2 h-6 border-l' />
        <Button
          onClick={exportWorkflow}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          title="Exporter le workflow en JSON"
        >
          <DownloadIcon size={14} />
          Export JSON
        </Button>
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={importWorkflow}
            className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
            id="import-workflow"
          />
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            title="Importer un workflow depuis un fichier JSON"
            asChild
          >
            <label htmlFor="import-workflow" className="cursor-pointer">
              <UploadIcon size={14} />
              Import JSON
            </label>
          </Button>
        </div>
        <div className="flex-1" />
        <Button 
          onClick={handleRun} 
          disabled={isRunning}
          className="flex items-center gap-2"
        >
          <PlayIcon size={16} />
          {isRunning ? 'Running...' : 'Run'}
        </Button>
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