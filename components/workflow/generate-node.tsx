'use client';

import { useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { TrashIcon } from '@/components/icons';

// Settings Icon Component
const SettingsIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6"/>
    <path d="m15.5 3.5-3 3-3-3"/>
    <path d="m15.5 20.5-3-3-3 3"/>
    <path d="M1 12h6m6 0h6"/>
    <path d="m3.5 15.5 3-3 3 3"/>
    <path d="m20.5 15.5-3-3-3 3"/>
  </svg>
);
import { chatModels } from '@/lib/ai/models';
import type { Variable } from './variables-panel';

interface GenerateNodeData {
  label: string;
  selectedModel: string;
  result: string;
  variableName: string;
  systemPrompt?: string;
  userPrompt?: string;
  variables?: Variable[];
  connectedResults?: { [key: string]: string };
  isLoading?: boolean;
  executionState?: 'idle' | 'preparing' | 'processing' | 'completing' | 'completed' | 'error';
  onModelChange: (model: string) => void;
  onVariableNameChange: (name: string) => void;
  onSystemPromptChange?: (text: string) => void;
  onUserPromptChange?: (text: string) => void;
  onDelete?: () => void;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

export function GenerateNode({ data, selected }: NodeProps) {
  const nodeData = data as GenerateNodeData;

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    // Only apply connection highlighting when actually connecting
    if (!nodeData.connectingFrom) return '';
    
    const isHighlighted = nodeData.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = nodeData.connectingFrom && !isHighlighted;
    
    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  }, [nodeData.connectingFrom, nodeData.isHandleHighlighted]);


  // Helper function to get border styles based on execution state
  const getExecutionBorderStyles = useCallback(() => {
    const currentState = nodeData.executionState || 'idle';
    
    switch (currentState) {
      case 'preparing':
      case 'processing':
      case 'completing':
        return 'border-2 border-orange-500 bg-background/50 backdrop-blur-sm shadow-lg shadow-orange-500/30 animate-breathing';
      case 'completed':
        return 'border-2 border-green-500 bg-background/50 backdrop-blur-sm shadow-md shadow-green-500/20';
      case 'error':
        return 'border-2 border-red-500 bg-background/50 backdrop-blur-sm shadow-lg shadow-red-500/30';
      case 'idle':
      default:
        return 'border-2 border-border/60 hover:border-border bg-background/50 backdrop-blur-sm shadow-sm';
    }
  }, [nodeData.executionState]);

  return (
    <div className="relative">
      {/* Files Handle Label */}
      <div className="absolute -top-8 left-0 right-0">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          Files
        </div>
      </div>
      
      <div 
        className={`group min-w-[250px] cursor-pointer rounded-lg transition-all duration-300 ${getExecutionBorderStyles()} ${selected ? 'ring-2 ring-orange-500' : ''}`}
      >
        <div className='p-0'>
          {/* Main content with robot icon and name */}
          <div className="flex h-20">
            {/* AI Icon - Full height left side */}
            <div className="w-16 rounded-l-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" className="text-gray-700 dark:text-gray-300">
                <path fill="currentColor" d="M18.5 10.255q0 .067-.003.133A1.54 1.54 0 0 0 17.473 10q-.243 0-.473.074V5.75a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75v4.505c0 .414.336.75.75.75h8.276l-.01.025l-.003.012l-.45 1.384l-.01.026l-.019.053H7.75a2.25 2.25 0 0 1-2.25-2.25V5.75A2.25 2.25 0 0 1 7.75 3.5h3.5v-.75a.75.75 0 0 1 .649-.743L12 2a.75.75 0 0 1 .743.649l.007.101l-.001.75h3.5a2.25 2.25 0 0 1 2.25 2.25zm-5.457 3.781l.112-.036H6.254a2.25 2.25 0 0 0-2.25 2.25v.907a3.75 3.75 0 0 0 1.305 2.844c1.563 1.343 3.802 2 6.691 2c2.076 0 3.817-.339 5.213-1.028a1.55 1.55 0 0 1-1.169-1.003l-.004-.012l-.03-.093c-1.086.422-2.42.636-4.01.636c-2.559 0-4.455-.556-5.713-1.638a2.25 2.25 0 0 1-.783-1.706v-.907a.75.75 0 0 1 .75-.75H12v-.003a1.54 1.54 0 0 1 1.031-1.456zM10.999 7.75a1.25 1.25 0 1 0-2.499 0a1.25 1.25 0 0 0 2.499 0m3.243-1.25a1.25 1.25 0 1 1 0 2.499a1.25 1.25 0 0 1 0-2.499m1.847 10.912a2.83 2.83 0 0 0-1.348-.955l-1.377-.448a.544.544 0 0 1 0-1.025l1.377-.448a2.84 2.84 0 0 0 1.76-1.762l.01-.034l.449-1.377a.544.544 0 0 1 1.026 0l.448 1.377a2.84 2.84 0 0 0 1.798 1.796l1.378.448l.027.007a.544.544 0 0 1 0 1.025l-1.378.448a2.84 2.84 0 0 0-1.798 1.796l-.447 1.377a.55.55 0 0 1-.2.263a.544.544 0 0 1-.827-.263l-.448-1.377a2.8 2.8 0 0 0-.45-.848m7.694 3.801l-.765-.248a1.58 1.58 0 0 1-.999-.998l-.249-.765a.302.302 0 0 0-.57 0l-.249.764a1.58 1.58 0 0 1-.983.999l-.766.248a.302.302 0 0 0 0 .57l.766.249a1.58 1.58 0 0 1 .999 1.002l.248.764a.303.303 0 0 0 .57 0l.25-.764a1.58 1.58 0 0 1 .998-.999l.766-.248a.302.302 0 0 0 0-.57z"/>
              </svg>
            </div>
            
            {/* Content area - Name and model info */}
            <div className="flex-1 flex items-center px-3">
              <div className="text-left">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                  {nodeData.variableName || 'AI Agent 1'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Model: {chatModels.find(m => m.id === nodeData.selectedModel)?.name || nodeData.selectedModel}
                </div>
              </div>
            </div>
          </div>
        {/* Input Handle (left side, rectangular) */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className={getHandleClassName('input', 'target')}
          style={{ 
            left: '-6px',
            top: '50%',
            width: '12px', 
            height: '24px', 
            backgroundColor: '#6b7280', 
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
            transform: 'translateY(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '2px',
            zIndex: 10
          }}
        />
        
        {/* Files Handle (top, rectangular) */}
        <Handle
          type="target"
          position={Position.Top}
          id="files"
          className={getHandleClassName('files', 'target')}
          style={{ 
            left: '50%', 
            top: '-6px',
            width: '24px', 
            height: '12px', 
            backgroundColor: '#6b7280', 
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '2px',
            zIndex: 10
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className={getHandleClassName('output', 'source')}
          style={{ 
            right: '-8px',
            top: '50%',
            width: '16px', 
            height: '16px', 
            backgroundColor: '#6b7280', 
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
            transform: 'translateY(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
          }}
        />
      </div>
    </div>
    </div>
  );
}