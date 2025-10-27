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

  // Better spacing: 50px per output with minimum height
  const heightPerOutput = 50;
  const dynamicHeight = Math.max(120, 80 + (totalOutputs * heightPerOutput));

  return (
    <div className="relative">
      <div
        className={`group min-w-[280px] cursor-pointer rounded-lg transition-all duration-300 ${getExecutionBorderStyles()} ${selected ? 'ring-2 ring-purple-500' : ''}`}
        style={{ height: `${dynamicHeight}px` }}
      >
        {/* Header section */}
        <div className="flex h-20 border-b border-border/40">
          {/* Icon on left - no background */}
          <div className='flex w-16 items-center justify-center'>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" className="text-purple-600 dark:text-purple-400">
              <path fill="currentColor" d="M7 10h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z"/>
              <path fill="currentColor" d="M20.3 12.04L19.71 9.3c-.14-.6-.54-1.1-1.09-1.36l-2.25-1.07c-.22-.1-.46-.15-.71-.15h-2.53L12.5 6h-1l-.63.72H8.34c-.25 0-.49.05-.71.15L5.38 7.94c-.55.26-.95.76-1.09 1.36l-.59 2.74a2.08 2.08 0 0 0 .42 1.73l1.38 1.65v3.33c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-3.33l1.38-1.65c.38-.46.52-1.07.42-1.73M18 17.75c0 .14-.11.25-.25.25H6.25a.25.25 0 0 1-.25-.25v-2.91l.5.6c.26.31.65.49 1.06.49h9.13c.41 0 .8-.18 1.06-.49l.5-.6v2.91M19.04 13l-1.88 2.25c-.09.1-.22.16-.35.16H7.19c-.13 0-.26-.06-.35-.16L4.96 13a.51.51 0 0 1-.1-.42l.59-2.74c.04-.15.13-.27.27-.33l2.25-1.07c.06-.03.12-.04.18-.04h7.7c.06 0 .12.01.18.04l2.25 1.07c.14.06.23.18.27.33l.59 2.74c.03.15 0 .3-.1.42"/>
            </svg>
          </div>

          {/* Name and info */}
          <div className='flex flex-1 flex-col justify-center px-3'>
            <div className='mb-0.5 font-medium text-gray-800 text-xs dark:text-gray-200'>
              {nodeData.variableName || 'Decision Node'}
            </div>
            <div className='text-gray-500 text-[10px] dark:text-gray-400'>
              {choices.length} choix + Else
            </div>
            {nodeData.selectedChoice && (
              <div className='mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 font-medium text-purple-700 text-[10px] dark:bg-purple-900/30 dark:text-purple-300'>
                → {nodeData.selectedChoice}
              </div>
            )}
          </div>
        </div>

        {/* Input Handle (left side) */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className={getHandleClassName('input', 'target')}
          style={{
            left: '-6px',
            top: '40px',
            width: '12px',
            height: '24px',
            backgroundColor: '#9333ea',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(147, 51, 234, 0.3)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '2px',
            zIndex: 10
          }}
        />

        {/* Output section - choices listed vertically */}
        <div className="px-3 py-3">
          <div className="space-y-2">
            {choices.map((choice, index) => {
              const yPosition = 80 + 20 + (index * heightPerOutput) + (heightPerOutput / 2);

              return (
                <div key={`choice-${index}`} className="relative flex items-center justify-between py-1.5">
                  {/* Label on left with badge */}
                  <div className='flex items-center gap-2'>
                    <div className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white shadow-sm'>
                      {index + 1}
                    </div>
                    <span className='truncate font-medium text-purple-700 text-sm dark:text-purple-300'>
                      {choice}
                    </span>
                  </div>

                  {/* Handle on right */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`choice-${index}`}
                    className={getHandleClassName(`choice-${index}`, 'source')}
                    style={{
                      position: 'absolute',
                      right: '-14px',
                      top: '50%',
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#9333ea',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 6px rgba(147, 51, 234, 0.3)',
                      transform: 'translateY(-50%)',
                      transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                      borderRadius: '50%'
                    }}
                  />
                </div>
              );
            })}

            {/* Else option */}
            <div className="relative flex items-center justify-between border-t border-border/40 py-1.5 pt-3">
              <div className='flex items-center gap-2'>
                <div className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-500 text-[11px] font-bold text-white shadow-sm'>
                  ?
                </div>
                <span className='font-medium text-gray-600 text-sm dark:text-gray-400'>
                  Else
                </span>
              </div>

              <Handle
                type="source"
                position={Position.Right}
                id="else"
                className={getHandleClassName('else', 'source')}
                style={{
                  position: 'absolute',
                  right: '-14px',
                  top: '50%',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#6b7280',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(-50%)',
                  transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                  borderRadius: '50%'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
