'use client';

import { useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface DecisionNodeData {
  label: string;
  selectedModel: string;
  result: string;
  variableName: string;
  instructions: string;
  choices: string[];
  variables?: any[];
  connectedResults?: { [key: string]: string };
  isLoading?: boolean;
  executionState?: 'idle' | 'preparing' | 'processing' | 'completing' | 'completed' | 'error';
  selectedChoice?: string;
  onModelChange: (model: string) => void;
  onVariableNameChange: (name: string) => void;
  onInstructionsChange?: (text: string) => void;
  onChoicesChange?: (choices: string[]) => void;
  onDelete?: () => void;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

export function DecisionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DecisionNodeData;

  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    if (!nodeData.connectingFrom) return '';
    const isHighlighted = nodeData.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = nodeData.connectingFrom && !isHighlighted;
    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  }, [nodeData.connectingFrom, nodeData.isHandleHighlighted]);

  const getExecutionBorderStyles = useCallback(() => {
    const currentState = nodeData.executionState || 'idle';
    switch (currentState) {
      case 'preparing':
      case 'processing':
      case 'completing':
        return 'border-2 border-purple-500 bg-background/50 backdrop-blur-sm shadow-lg shadow-purple-500/30 animate-breathing';
      case 'completed':
        return 'border-2 border-green-500 bg-background/50 backdrop-blur-sm shadow-md shadow-green-500/20';
      case 'error':
        return 'border-2 border-red-500 bg-background/50 backdrop-blur-sm shadow-lg shadow-red-500/30';
      case 'idle':
      default:
        return 'border-2 border-border/60 hover:border-border bg-background/50 backdrop-blur-sm shadow-sm';
    }
  }, [nodeData.executionState]);

  const choices = nodeData.choices || [];
  const totalOutputs = choices.length + 1;

  // Better spacing for larger node
  const heightPerOutput = 42;
  const headerHeight = nodeData.instructions ? 'auto' : 70;
  const dynamicHeight = typeof headerHeight === 'number'
    ? headerHeight + (totalOutputs * heightPerOutput) + 24
    : 'auto';

  return (
    <div className="relative">
      <div
        className={`group min-w-[280px] max-w-[320px] cursor-pointer rounded-lg transition-all duration-300 ${getExecutionBorderStyles()} ${selected ? 'ring-2 ring-purple-500' : ''}`}
        style={typeof dynamicHeight === 'number' ? { height: `${dynamicHeight}px` } : {}}
      >
        {/* Header section - showing instructions */}
        <div className='border-border/40 border-b px-3 py-3'>
          <div className='flex items-start gap-2.5'>
            {/* Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className='mt-0.5 flex-shrink-0 text-purple-600 dark:text-purple-400'>
              <path fill="currentColor" d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V7l-10-5m0 2.18L18 7.5v8.5c0 4.27-2.91 8.28-6 9.31c-3.09-1.03-6-5.04-6-9.31V7.5l6-3.32M11 11v6h2v-6h-2m0-4v2h2V7h-2z"/>
            </svg>

            {/* Instructions or name */}
            <div className='min-w-0 flex-1'>
              {nodeData.instructions ? (
                <div className='text-gray-700 text-sm leading-relaxed dark:text-gray-300'>
                  {nodeData.instructions}
                </div>
              ) : (
                <div className='font-medium text-gray-800 text-sm dark:text-gray-200'>
                  {nodeData.variableName || 'Decision'}
                </div>
              )}
              {nodeData.selectedChoice && (
                <div className='mt-1.5 inline-block rounded-full bg-purple-100 px-2 py-0.5 font-medium text-[10px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'>
                  → {nodeData.selectedChoice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Input Handle (left side) - centered between border and content */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className={getHandleClassName('input', 'target')}
          style={{
            left: '-8px',
            top: '35px',
            width: '16px',
            height: '16px',
            backgroundColor: '#9333ea',
            border: '3px solid #ffffff',
            boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '50%',
            zIndex: 10
          }}
        />

        {/* Output section - simple and clean */}
        <div className="px-4 py-3">
          <div className="space-y-2.5">
            {choices.map((choice, index) => {
              return (
                <div
                  key={`choice-${index}`}
                  className="relative flex items-center gap-2.5 py-1"
                >
                  {/* Simple number */}
                  <span className='flex-shrink-0 font-medium text-purple-600 text-sm dark:text-purple-400'>
                    {index + 1}.
                  </span>

                  {/* Choice text */}
                  <span className='flex-1 truncate text-gray-800 text-sm dark:text-gray-200'>
                    {choice}
                  </span>

                  {/* Handle - centered between border and content */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`choice-${index}`}
                    className={getHandleClassName(`choice-${index}`, 'source')}
                    style={{
                      position: 'absolute',
                      right: '-8px',
                      top: '50%',
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#9333ea',
                      border: '3px solid #ffffff',
                      boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)',
                      transform: 'translateY(-50%)',
                      transition: 'all 0.3s ease',
                      borderRadius: '50%',
                      zIndex: 10
                    }}
                  />
                </div>
              );
            })}

            {/* Else option - simple separator */}
            <div className='relative flex items-center gap-2.5 border-border/30 border-t pt-2.5'>
              <span className='flex-shrink-0 font-medium text-gray-500 text-sm dark:text-gray-400'>
                ⊗
              </span>

              <span className='flex-1 text-gray-600 text-sm dark:text-gray-400'>
                Else
              </span>

              <Handle
                type="source"
                position={Position.Right}
                id="else"
                className={getHandleClassName('else', 'source')}
                style={{
                  position: 'absolute',
                  right: '-8px',
                  top: '50%',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#6b7280',
                  border: '3px solid #ffffff',
                  boxShadow: '0 2px 8px rgba(107, 114, 128, 0.4)',
                  transform: 'translateY(-50%)',
                  transition: 'all 0.3s ease',
                  borderRadius: '50%',
                  zIndex: 10
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
