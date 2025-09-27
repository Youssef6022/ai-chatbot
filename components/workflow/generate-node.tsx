'use client';

import { useState, useCallback, useEffect } from 'react';
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
  isHandleHighlighted?: (handleId: string, handleType: 'source' | 'target') => boolean;
  connectingFrom?: { nodeId: string; handleId: string; handleType: 'source' | 'target' } | null;
}

export function GenerateNode({ data, selected }: NodeProps<GenerateNodeData>) {
  const [localVariableName, setLocalVariableName] = useState(data.variableName || 'AI Agent 1');
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const handleVariableNameChange = useCallback((value: string) => {
    setLocalVariableName(value);
    data.onVariableNameChange?.(value);
  }, [data]);

  // Initialize with default AI Agent name if empty or result_X format
  useEffect(() => {
    if (!data.variableName || data.variableName.startsWith('result_')) {
      const defaultName = 'AI Agent 1';
      setLocalVariableName(defaultName);
      data.onVariableNameChange?.(defaultName);
    } else {
      setLocalVariableName(data.variableName);
    }
  }, [data.variableName, data.onVariableNameChange]);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingName(false);
    }
    if (e.key === 'Escape') {
      setLocalVariableName(data.variableName || '');
      setIsEditingName(false);
    }
  };

  // Helper function to get handle CSS classes based on highlighting state
  const getHandleClassName = useCallback((handleId: string, handleType: 'source' | 'target') => {
    if (!data.connectingFrom) return '';
    
    const isHighlighted = data.isHandleHighlighted?.(handleId, handleType);
    const shouldDim = data.connectingFrom && !isHighlighted;
    
    if (isHighlighted) return 'handle-highlighted';
    if (shouldDim) return 'handle-dimmed';
    return '';
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
      
      <Card className={`group min-w-[350px] border-2 border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className='p-0'>
          {/* Main content with robot icon and name */}
          <div className="flex h-32">
            {/* Robot Icon - Full height left side */}
            <div className="w-20 rounded-l-lg flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/>
                <path d="M20 14h2"/>
                <path d="M15 13v2"/>
                <path d="M9 13v2"/>
              </svg>
            </div>
            
            {/* Content area */}
            <div className="flex-1 flex items-center justify-between px-3">
              {/* Agent Name and Model Selector */}
              <div className="flex flex-col justify-center gap-2 flex-1">
                {/* Agent Name */}
                <div>
                  {isEditingName ? (
                    <form onSubmit={handleNameSubmit}>
                      <Input
                        value={localVariableName}
                        onChange={(e) => handleVariableNameChange(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        onBlur={() => setIsEditingName(false)}
                        className="h-6 text-sm font-medium border-none p-0 focus-visible:ring-0 bg-transparent"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <div 
                      onClick={handleNameClick}
                      className="text-sm font-medium cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                    >
                      {localVariableName}
                    </div>
                  )}
                </div>
                
                {/* Model Selector */}
                <div className="w-full max-w-[200px]">
                  <Select
                    value={data.selectedModel}
                    onValueChange={data.onModelChange}
                  >
                    <SelectTrigger className="w-full h-7 text-xs">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-xs">{model.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Right side - Loading or View Result */}
              <div className="flex items-center gap-2">
              {data.isLoading ? (
                <div className="flex items-center gap-2">
                  <LoaderIcon size={16} className="animate-spin" />
                  <span className="text-xs text-muted-foreground">Running...</span>
                </div>
              ) : data.result ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsResultModalOpen(true)}
                  className="text-xs h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  View result
                </Button>
              ) : null}
              
              {/* Delete button */}
              {data.onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={data.onDelete}
                  className='h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <TrashIcon size={12} />
                </Button>
              )}
              </div>
            </div>
          </div>
        {/* System Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="system"
          className={getHandleClassName('system', 'target')}
          style={{ 
            left: '25%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        
        {/* User Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="user"
          className={getHandleClassName('user', 'target')}
          style={{ 
            left: '50%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        
        {/* Files Handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="files"
          className={getHandleClassName('files', 'target')}
          style={{ 
            left: '75%', 
            top: '-10px',
            width: '40px', 
            height: '20px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '4px',
            zIndex: 10
          }}
        />
        

        {/* Result Modal */}
        <Dialog open={isResultModalOpen} onOpenChange={setIsResultModalOpen}>
          <DialogContent className='max-w-4xl max-h-[80vh]'>
            <DialogHeader>
              <DialogTitle>{localVariableName} - Result</DialogTitle>
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
          className={getHandleClassName('output', 'source')}
          style={{ 
            right: '-12px',
            width: '24px', 
            height: '24px', 
            backgroundColor: '#d1d5db', 
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transform: 'none',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
          }}
        />
      </CardContent>
    </Card>
    </div>
  );
}