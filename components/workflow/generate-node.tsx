'use client';

import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoaderIcon, TrashIcon } from '@/components/icons';
import { chatModels } from '@/lib/ai/models';

interface GenerateNodeData {
  label: string;
  selectedModel: string;
  result: string;
  variableName: string;
  isLoading?: boolean;
  onModelChange: (model: string) => void;
  onVariableNameChange: (name: string) => void;
  onDelete?: () => void;
}

export function GenerateNode({ data, selected }: NodeProps<GenerateNodeData>) {
  const [localVariableName, setLocalVariableName] = useState(data.variableName || '');
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  const handleVariableNameChange = useCallback((value: string) => {
    setLocalVariableName(value);
    data.onVariableNameChange?.(value);
  }, [data]);

  return (
    <div className="relative">
      {/* Input Labels */}
      <div className="absolute -top-8 left-0 right-0">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 absolute" style={{ left: '25%', transform: 'translateX(-50%)' }}>
          System
        </div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          User
        </div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 absolute" style={{ left: '75%', transform: 'translateX(-50%)' }}>
          Files
        </div>
      </div>
      
      <Card className={`min-w-[400px] border-2 border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className='flex items-center justify-between font-medium text-sm'>
            <span className="flex items-center gap-2">
              🤖 Generate Text
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
        {/* System Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="system"
          style={{ 
            left: '25%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'none',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        
        {/* User Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="user"
          style={{ 
            left: '50%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'none',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        
        {/* Files Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="files"
          style={{ 
            left: '75%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'none',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        

        <div>
          <Label className='mb-1 block font-medium text-muted-foreground text-xs'>
            Variable Name
          </Label>
          <Input
            value={localVariableName}
            onChange={(e) => handleVariableNameChange(e.target.value)}
            placeholder="result_1"
            className="h-8"
          />
          <div className='mt-1 text-muted-foreground text-xs'>
            Use as: {`{${localVariableName || 'result_1'}}`}
          </div>
        </div>

        <div>
          <Label className='mb-1 block font-medium text-muted-foreground text-xs'>
            AI Model
          </Label>
          <Select
            value={data.selectedModel}
            onValueChange={data.onModelChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {chatModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{model.name}</span>
                    <span className='text-muted-foreground text-xs'>
                      {model.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isResultModalOpen} onOpenChange={setIsResultModalOpen}>
          <DialogTrigger asChild>
            <div className="cursor-pointer">
              <label className='mb-1 block font-medium text-muted-foreground text-xs'>
                Result (Click to view)
              </label>
              <Card className="border-dashed hover:bg-muted/50 transition-colors">
                <CardContent className="p-3">
                  {data.isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <LoaderIcon size={20} />
                      <span className='ml-2 text-muted-foreground text-sm'>
                        Generating...
                      </span>
                    </div>
                  ) : (
                    <div className='text-muted-foreground text-sm italic text-center py-4'>
                      {data.result ? 'Click to view result' : 'Connect prompts and run to see results'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogTrigger>
          <DialogContent className='max-w-4xl max-h-[80vh]'>
            <DialogHeader>
              <DialogTitle>Generation Result</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] w-full">
              {data.result ? (
                <div className='whitespace-pre-wrap text-sm p-4'>
                  {data.result}
                </div>
              ) : (
                <div className='text-muted-foreground text-sm italic text-center py-8'>
                  No result available. Connect prompts and run generation.
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ 
            right: '-12px',
            width: '24px', 
            height: '24px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'none',
            transition: 'none'
          }}
        />
      </CardContent>
    </Card>
    </div>
  );
}