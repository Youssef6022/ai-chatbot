'use client';

import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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

  const handleVariableNameChange = useCallback((value: string) => {
    setLocalVariableName(value);
    data.onVariableNameChange?.(value);
  }, [data]);

  return (
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
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className='!bg-blue-500 !border-2 !border-white h-3 w-3'
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

        <div>
          <label className='mb-1 block font-medium text-muted-foreground text-xs'>
            Result
          </label>
          <Card className="border-dashed">
            <CardContent className="p-3">
              {data.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderIcon size={24} />
                  <span className='ml-2 text-muted-foreground text-sm'>
                    Generating...
                  </span>
                </div>
              ) : (
                <ScrollArea className="h-[150px] w-full">
                  {data.result ? (
                    <div className='whitespace-pre-wrap text-sm'>
                      {data.result}
                    </div>
                  ) : (
                    <div className='text-muted-foreground text-sm italic'>
                      Connect a prompt and run to see results...
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

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