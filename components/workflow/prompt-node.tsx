'use client';

import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PromptNodeData {
  label: string;
  text: string;
  onTextChange: (text: string) => void;
}

export function PromptNode({ data, selected }: NodeProps<PromptNodeData>) {
  const [localText, setLocalText] = useState(data.text || '');

  const handleTextChange = useCallback((value: string) => {
    setLocalText(value);
    data.onTextChange?.(value);
  }, [data]);

  return (
    <Card className={`min-w-[300px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          📝 {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          value={localText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter your prompt here..."
          className="min-h-[100px] resize-none"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
        />
      </CardContent>
    </Card>
  );
}