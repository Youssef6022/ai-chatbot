'use client';

import { useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrashIcon } from '@/components/icons';
import type { Variable } from './variables-panel';

interface PromptNodeData {
  label: string;
  text: string;
  variables?: Variable[];
  connectedResults?: { [key: string]: string }; // Results from connected Generate nodes
  onTextChange: (text: string) => void;
  onDelete?: () => void;
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

// Message Icon Component
const MessageIcon = ({ size = 24 }: { size?: number }) => (
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
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export function PromptNode({ data, selected }: NodeProps<PromptNodeData>) {
  const [localText, setLocalText] = useState(data.text || '');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Synchroniser l'état local avec les props quand data.text change (ex: lors d'un import)
  useEffect(() => {
    if (data.text !== localText) {
      setLocalText(data.text || '');
    }
  }, [data.text, localText]);

  const handleTextChange = useCallback((value: string) => {
    setLocalText(value);
    data.onTextChange?.(value);
  }, [data]);

  const insertVariable = useCallback((varName: string) => {
    const textArea = document.querySelector('textarea[data-prompt-editor="true"]') as HTMLTextAreaElement;
    const cursorPosition = textArea?.selectionStart || localText.length;
    const newText = `${localText.slice(0, cursorPosition)}{${varName}}${localText.slice(cursorPosition)}`;
    handleTextChange(newText);
  }, [localText, handleTextChange]);

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    if (!data.connectingFrom) return '';
    
    const isHighlighted = data.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = data.connectingFrom && !isHighlighted;
    
    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
  }, [data]);

  const getPreviewText = () => {
    if (!localText || localText.trim() === '') return 'Click to edit prompt';
    return localText.length > 30 ? `${localText.slice(0, 30)}...` : localText;
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={getHandleClassName('input', 'target')}
        style={{ 
          left: '-8px',
          top: '50%',
          width: '16px', 
          height: '32px', 
          backgroundColor: '#3b82f6', 
          border: '2px solid white',
          boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
          transform: 'translateY(-50%)',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
          zIndex: 10,
          borderRadius: '3px'
        }}
      />
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <div className="relative group">
            <Card className={`group relative min-w-[150px] min-h-[150px] max-w-[150px] cursor-pointer border-2 border-blue-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg ${selected ? 'ring-2 ring-blue-500' : ''}`}>
            <CardContent className='flex items-center justify-center h-[150px] w-[150px] relative'>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                <path d="M5 12a5 5 0 0 1 7 7m-7-7a5 5 0 0 0-2 4a5 5 0 0 0 .224 1.483c.272.88.076 1.86-.099 2.784a.468.468 0 0 0 .592.539c.848-.232 1.691-.43 2.557-.112A5 5 0 0 0 8 21a4.99 4.99 0 0 0 4-2m-7-7c0-4.685 2.875-9 8-9a8 8 0 0 1 7.532 10.7c-.476 1.326.037 3.102.337 4.568a.451.451 0 0 1-.584.526c-1.312-.41-2.852-.986-4.085-.466c-1.334.562-2.736.672-4.2.672"/>
              </svg>
              
              {data.onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                  }}
                  className='absolute top-2 right-2 h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <TrashIcon size={12} />
                </Button>
              )}
            </CardContent>
            </Card>
            
          </div>
        </DialogTrigger>
        
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MessageIcon size={20} />
              Edit Text Input
            </DialogTitle>
          </DialogHeader>
          
          <div className='space-y-4'>
            <Textarea
              data-prompt-editor="true"
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Enter your text here... Use {variable_name} to insert variables."
              className="min-h-[200px] resize-none"
            />
            
            {/* Variables section */}
            {((data.variables && data.variables.length > 0) || (data.connectedResults && Object.keys(data.connectedResults).length > 0)) && (
              <div className="space-y-3">
                {data.variables && data.variables.length > 0 && (
                  <div>
                    <div className='mb-2 font-medium text-muted-foreground text-sm'>Global Variables:</div>
                    <div className="flex flex-wrap gap-2">
                      {data.variables.map((variable) => (
                        <Button
                          key={variable.id}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-sm"
                          onClick={() => insertVariable(variable.name)}
                        >
                          {variable.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                {data.connectedResults && Object.keys(data.connectedResults).length > 0 && (
                  <div>
                    <div className='mb-2 font-medium text-muted-foreground text-sm'>Connected Results:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(data.connectedResults).map((resultName) => (
                        <Button
                          key={resultName}
                          variant="outline"
                          size="sm"
                          className='h-8 bg-blue-50 px-3 text-sm dark:bg-blue-950'
                          onClick={() => insertVariable(resultName)}
                        >
                          {resultName}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className='flex justify-end gap-2'>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className={getHandleClassName('output', 'source')}
        style={{ 
          bottom: '-10px',
          left: '50%',
          width: '20px', 
          height: '20px', 
          backgroundColor: '#3b82f6', 
          border: '2px solid white',
          boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
          transform: 'translateX(-50%)',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
          zIndex: 10
        }}
      />
    </>
  );
}