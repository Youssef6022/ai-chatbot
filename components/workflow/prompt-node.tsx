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
        className='!bg-blue-500 !border-2 !border-white h-3 w-3'
      />
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Card className={`relative min-w-[160px] max-w-[200px] cursor-pointer border-2 border-gray-300 transition-all duration-200 hover:scale-105 hover:shadow-lg ${selected ? 'ring-2 ring-blue-500' : ''}`}>
            <CardContent className='flex flex-col items-center justify-center p-4 text-center'>
              <div className='mb-2 flex items-center justify-center rounded-full bg-blue-100 p-3 dark:bg-blue-900'>
                <MessageIcon size={20} className='text-blue-600 dark:text-blue-400' />
              </div>
              <h3 className='mb-1 font-medium text-sm'>Text Input</h3>
              <p className='text-muted-foreground text-xs leading-relaxed'>{getPreviewText()}</p>
              
              {data.onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                  }}
                  className='absolute top-1 right-1 h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700'
                >
                  <TrashIcon size={10} />
                </Button>
              )}
            </CardContent>
          </Card>
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
        position={Position.Right}
        id="output"
        className='!bg-blue-500 !border-2 !border-white h-3 w-3'
      />
    </>
  );
}