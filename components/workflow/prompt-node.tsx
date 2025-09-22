'use client';

import { useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export function PromptNode({ data, selected }: NodeProps<PromptNodeData>) {
  const [localText, setLocalText] = useState(data.text || '');

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
    const cursorPosition = (document.activeElement as HTMLTextAreaElement)?.selectionStart || localText.length;
    const newText = `${localText.slice(0, cursorPosition)}{${varName}}${localText.slice(cursorPosition)}`;
    handleTextChange(newText);
  }, [localText, handleTextChange]);

  return (
    <Card className={`min-w-[350px] border-2 border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className='flex items-center justify-between font-medium text-sm'>
          <span className="flex items-center gap-2">
            📝 Text Input
          </span>
          {data.onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={data.onDelete}
              className='h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700'
            >
              <TrashIcon size={12} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 pt-0'>
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className='!bg-blue-500 !border-2 !border-white h-3 w-3'
        />
        
        <Textarea
          value={localText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter your text here... Use {variable_name} to insert variables."
          className="min-h-[100px] resize-none"
        />
        
        {/* Variables section */}
        {((data.variables && data.variables.length > 0) || (data.connectedResults && Object.keys(data.connectedResults).length > 0)) && (
          <div className="space-y-2">
            {data.variables && data.variables.length > 0 && (
              <div>
                <div className='mb-2 font-medium text-muted-foreground text-xs'>Global Variables:</div>
                <div className="flex flex-wrap gap-1">
                  {data.variables.map((variable) => (
                    <Button
                      key={variable.id}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
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
                <div className='mb-2 font-medium text-muted-foreground text-xs'>Connected Results:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(data.connectedResults).map((resultName) => (
                    <Button
                      key={resultName}
                      variant="outline"
                      size="sm"
                      className='h-6 bg-blue-50 px-2 text-xs'
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
        
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className='!bg-blue-500 !border-2 !border-white h-3 w-3'
        />
      </CardContent>
    </Card>
  );
}