'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  Panel,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { PromptNode } from '@/components/workflow/prompt-node';
import { GenerateNode } from '@/components/workflow/generate-node';
import { VariablesPanel, type Variable } from '@/components/workflow/variables-panel';
import { PlayIcon, PlusIcon } from '@/components/icons';

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
      label: 'Prompt',
      text: 'Write a short story about...',
      onTextChange: () => {},
    },
  },
  {
    id: '2',
    type: 'generate',
    position: { x: 400, y: 100 },
    data: { 
      label: 'Generate',
      selectedModel: 'chat-model-medium',
      result: '',
      onModelChange: () => {},
    },
  },
];

const initialEdges: Edge[] = [];

export default function WorkflowsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        // Supprimer toute connexion existante depuis la même source (un Prompt ne peut avoir qu'une sortie)
        const edgesWithoutSourceConnection = eds.filter(edge => 
          !(edge.source === params.source && edge.sourceHandle === params.sourceHandle)
        );
        
        // Supprimer toute connexion existante vers la même cible (un Generate ne peut avoir qu'une entrée)
        const edgesWithoutTargetConnection = edgesWithoutSourceConnection.filter(edge => 
          !(edge.target === params.target && edge.targetHandle === params.targetHandle)
        );
        
        // Ajouter la nouvelle connexion
        return addEdge(params, edgesWithoutTargetConnection);
      });
    },
    [setEdges]
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

  const addPromptNode = useCallback(() => {
    const newNode = {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      position: { x: Math.random() * 300, y: Math.random() * 300 },
      data: {
        label: 'Prompt',
        text: '',
        variables,
        onTextChange: () => {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, variables]);

  const addGenerateNode = useCallback(() => {
    const newNode = {
      id: `generate-${Date.now()}`,
      type: 'generate',
      position: { x: Math.random() * 300 + 400, y: Math.random() * 300 },
      data: {
        label: 'Generate',
        selectedModel: 'chat-model-medium',
        result: '',
        onModelChange: () => {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

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
            
            // Replace variables in prompt text
            let processedPrompt = promptNode.data.text;
            variables.forEach(variable => {
              const placeholder = `{${variable.name}}`;
              processedPrompt = processedPrompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), variable.value);
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
  }, [nodes, edges, updateNodeData]);

  // Update nodes with callback functions and variables
  const nodesWithCallbacks = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      variables: node.type === 'prompt' ? variables : undefined,
      onTextChange: node.type === 'prompt' 
        ? (text: string) => updateNodeData(node.id, { text })
        : undefined,
      onModelChange: node.type === 'generate'
        ? (model: string) => updateNodeData(node.id, { selectedModel: model })
        : undefined,
    }
  }));

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b bg-background">
        <Button
          onClick={addPromptNode}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusIcon size={14} />
          📝 Prompt
        </Button>
        <Button
          onClick={addGenerateNode}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <PlusIcon size={14} />
          🤖 Generate
        </Button>
        <div className="border-l h-6 mx-2" />
        <VariablesPanel 
          variables={variables} 
          onVariablesChange={setVariables} 
        />
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