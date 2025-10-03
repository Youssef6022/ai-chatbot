'use client';

import { useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [localVariableName, setLocalVariableName] = useState(nodeData.variableName || 'AI Agent 1');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(nodeData.systemPrompt || '');
  const [localUserPrompt, setLocalUserPrompt] = useState(nodeData.userPrompt || '');
  const [activeField, setActiveField] = useState<'system' | 'user'>('user');

  const handleVariableNameChange = useCallback((value: string) => {
    setLocalVariableName(value);
  }, []);

  const handleVariableNameSubmit = useCallback((value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue && trimmedValue !== nodeData.variableName) {
      nodeData.onVariableNameChange?.(trimmedValue);
    }
  }, [nodeData]);

  // Initialize with default AI Agent name if empty or result_X format
  useEffect(() => {
    if (!nodeData.variableName || nodeData.variableName.startsWith('result_')) {
      const defaultName = 'AI Agent 1';
      setLocalVariableName(defaultName);
      nodeData.onVariableNameChange?.(defaultName);
    } else {
      setLocalVariableName(nodeData.variableName);
    }
  }, [nodeData.variableName, nodeData.onVariableNameChange]);

  // Sync local state when nodeData changes (for validation failures)
  useEffect(() => {
    if (!isEditingName && nodeData.variableName !== localVariableName) {
      setLocalVariableName(nodeData.variableName || '');
    }
  }, [nodeData.variableName, isEditingName]);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVariableNameSubmit(localVariableName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVariableNameSubmit(localVariableName);
      setIsEditingName(false);
    }
    if (e.key === 'Escape') {
      setLocalVariableName(nodeData.variableName || '');
      setIsEditingName(false);
    }
  };

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

  // Sync local prompts with nodeData
  useEffect(() => {
    setLocalSystemPrompt(nodeData.systemPrompt || '');
    setLocalUserPrompt(nodeData.userPrompt || '');
  }, [nodeData.systemPrompt, nodeData.userPrompt]);

  const handleSystemPromptChange = useCallback((value: string) => {
    setLocalSystemPrompt(value);
    nodeData.onSystemPromptChange?.(value);
  }, [nodeData]);

  const handleUserPromptChange = useCallback((value: string) => {
    setLocalUserPrompt(value);
    nodeData.onUserPromptChange?.(value);
  }, [nodeData]);

  const insertVariable = useCallback((varName: string) => {
    const systemTextArea = document.getElementById('system-prompt-editor') as HTMLTextAreaElement;
    const userTextArea = document.getElementById('user-prompt-editor') as HTMLTextAreaElement;
    
    const targetField = activeField;
    const textArea = targetField === 'system' ? systemTextArea : userTextArea;
    const currentText = targetField === 'system' ? localSystemPrompt : localUserPrompt;
    
    const cursorPosition = textArea?.selectionStart || currentText.length;
    const newText = `${currentText.slice(0, cursorPosition)}{{${varName}}}${currentText.slice(cursorPosition)}`;
    
    if (targetField === 'system') {
      handleSystemPromptChange(newText);
      // Refocus and position cursor after the inserted variable
      setTimeout(() => {
        if (systemTextArea) {
          systemTextArea.focus();
          const newPosition = cursorPosition + varName.length + 4; // +4 for the double braces
          systemTextArea.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    } else {
      handleUserPromptChange(newText);
      // Refocus and position cursor after the inserted variable
      setTimeout(() => {
        if (userTextArea) {
          userTextArea.focus();
          const newPosition = cursorPosition + varName.length + 4; // +4 for the double braces
          userTextArea.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  }, [activeField, localSystemPrompt, localUserPrompt, handleSystemPromptChange, handleUserPromptChange]);

  // Helper function to get border styles based on execution state
  const getBorderStyles = useCallback(() => {
    const baseStyles = 'border-2 transition-all duration-300';
    const currentState = nodeData.executionState || 'idle';
    
    switch (currentState) {
      case 'preparing':
      case 'processing':
      case 'completing':
        return `${baseStyles} border-orange-400 shadow-lg shadow-orange-400/30`;
      case 'completed':
        return `${baseStyles} border-green-500 shadow-md shadow-green-500/20`;
      case 'error':
        return `${baseStyles} border-red-500 shadow-lg shadow-red-500/30`;
      case 'idle':
      default:
        return `${baseStyles} border-blue-200`;
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
      
      <Card 
        className={`group min-w-[250px] ${getBorderStyles()} ${selected ? 'ring-2 ring-blue-500' : ''}`}
        onDoubleClick={() => {
          if (!isEditingName) {
            setIsEditModalOpen(true);
          }
        }}
      >
        <CardContent className='p-0'>
          {/* Main content with robot icon and name */}
          <div className="flex h-20">
            {/* Robot Icon - Full height left side */}
            <div className="w-16 rounded-l-lg flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/>
                <path d="M20 14h2"/>
                <path d="M15 13v2"/>
                <path d="M9 13v2"/>
              </svg>
            </div>
            
            {/* Content area - Just name centered */}
            <div className="flex-1 flex items-center justify-center px-2">
              <div className="text-center">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  {localVariableName}
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
            left: '-8px',
            top: '50%',
            width: '16px', 
            height: '32px', 
            backgroundColor: '#f97316', 
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
            transform: 'translateY(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '3px',
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
            top: '-8px',
            width: '32px', 
            height: '16px', 
            backgroundColor: '#f97316', 
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
            transform: 'translateX(-50%)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
            borderRadius: '3px',
            zIndex: 10
          }}
        />
        

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent 
            className='max-w-4xl max-h-[90vh]'
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="M2 14h2"/>
                  <path d="M20 14h2"/>
                  <path d="M15 13v2"/>
                  <path d="M9 13v2"/>
                </svg>
                Edit AI Generator - {localVariableName}
              </DialogTitle>
            </DialogHeader>
            
            <div className='space-y-6'>
              {/* Agent Name and Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agent-name-input" className="text-sm font-medium mb-2 block">
                    Agent Name
                  </Label>
                  <Input
                    id="agent-name-input"
                    value={localVariableName}
                    onChange={(e) => handleVariableNameChange(e.target.value)}
                    onBlur={() => handleVariableNameSubmit(localVariableName)}
                    placeholder="Enter agent name"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    AI Model
                  </Label>
                  <Select
                    value={nodeData.selectedModel}
                    onValueChange={nodeData.onModelChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{model.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* System Prompt */}
              <div>
                <Label htmlFor="system-prompt-editor" className="text-sm font-medium mb-2 block">
                  System Prompt
                </Label>
                <Textarea
                  id="system-prompt-editor"
                  value={localSystemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  onFocus={() => setActiveField('system')}
                  placeholder="Enter system instructions... Use {{variable_name}} to insert variables."
                  className="min-h-[120px] resize-none"
                />
              </div>
              
              {/* User Prompt */}
              <div>
                <Label htmlFor="user-prompt-editor" className="text-sm font-medium mb-2 block">
                  User Prompt
                </Label>
                <Textarea
                  id="user-prompt-editor"
                  value={localUserPrompt}
                  onChange={(e) => handleUserPromptChange(e.target.value)}
                  onFocus={() => setActiveField('user')}
                  placeholder="Enter user prompt... Use {{variable_name}} to insert variables."
                  className="min-h-[120px] resize-none"
                />
              </div>
              
              {/* Variables section */}
              {((nodeData.variables && nodeData.variables.length > 0) || (nodeData.connectedResults && Object.keys(nodeData.connectedResults).length > 0)) && (
                <div className="space-y-4">
                  {nodeData.variables && nodeData.variables.length > 0 && (
                    <div>
                      <div className='mb-2 font-medium text-muted-foreground text-sm'>Global Variables:</div>
                      <div className="flex flex-wrap gap-2">
                        {nodeData.variables.map((variable) => (
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
                  
                  {nodeData.connectedResults && Object.keys(nodeData.connectedResults).length > 0 && (
                    <div>
                      <div className='mb-2 font-medium text-muted-foreground text-sm'>Connected Results:</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(nodeData.connectedResults).map((resultName) => (
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
              
              {/* Result Display */}
              {nodeData.result && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Generated Result
                  </Label>
                  <ScrollArea className="h-[200px] w-full border rounded-md p-4">
                    <div className='whitespace-pre-wrap text-sm'>
                      {nodeData.result}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <div className='flex justify-end gap-2'>
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsEditModalOpen(false)}>
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
          className={getHandleClassName('output', 'source')}
          style={{ 
            right: '-10px',
            width: '20px', 
            height: '20px', 
            backgroundColor: '#f97316', 
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
            transform: 'none',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease'
          }}
        />
      </CardContent>
    </Card>
    </div>
  );
}