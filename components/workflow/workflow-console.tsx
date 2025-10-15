'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowUpIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chatModels } from '@/lib/ai/models';
import type { Variable } from './variables-panel';
import JSZip from 'jszip';

interface WorkflowConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedNode: any | null;
  activeTab: 'edit' | 'results';
  onTabChange: (tab: 'edit' | 'results') => void;
  executionLogs: Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>;
  variables?: Variable[];
  onNodeUpdate?: (nodeId: string, data: any) => void;
  nodes?: any[];
}

export function WorkflowConsole({
  isOpen,
  onToggle,
  selectedNode,
  activeTab,
  onTabChange,
  executionLogs,
  variables = [],
  onNodeUpdate,
  nodes = []
}: WorkflowConsoleProps) {
  const [localData, setLocalData] = useState<any>({});

  // Update local data when selected node changes
  const updateLocalData = useCallback((key: string, value: any) => {
    const newData = { ...localData, [key]: value };
    setLocalData(newData);
    
    // Update the node immediately
    if (selectedNode && onNodeUpdate) {
      onNodeUpdate(selectedNode.id, { [key]: value });
    }
  }, [localData, selectedNode, onNodeUpdate]);

  // Get current node data with local overrides
  const currentData = selectedNode ? { ...selectedNode.data, ...localData } : {};

  const insertVariable = useCallback((varName: string, targetField: 'systemPrompt' | 'userPrompt') => {
    const currentText = currentData[targetField] || '';
    const newText = `${currentText}{{${varName}}}`;
    updateLocalData(targetField, newText);
  }, [currentData, updateLocalData]);

  // Filter out duplicate logs using a Map to track unique combinations
  const uniqueLogs = useMemo(() => {
    const seen = new Map<string, boolean>();
    return executionLogs.filter(log => {
      // Create a unique key based on message, nodeName, and rounded timestamp (to nearest second)
      const roundedTime = Math.floor(log.timestamp.getTime() / 1000) * 1000;
      const uniqueKey = `${log.message}-${log.nodeName || 'no-node'}-${roundedTime}`;
      
      if (seen.has(uniqueKey)) {
        return false; // Duplicate found
      }
      
      seen.set(uniqueKey, true);
      return true;
    });
  }, [executionLogs]);

  // Helper function to replace variables in text with actual values
  const replaceVariables = useCallback((text: string, generateNodes: any[], currentNodeId: string) => {
    let replacedText = text;
    
    // Replace variables from other AI generators
    generateNodes.forEach(node => {
      if (node.id !== currentNodeId && node.data.variableName && node.data.result) {
        const variablePattern = new RegExp(`\\{\\{${node.data.variableName}\\}\\}`, 'g');
        replacedText = replacedText.replace(variablePattern, node.data.result);
      }
    });
    
    // Replace global variables if any
    variables.forEach(variable => {
      const variablePattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      replacedText = replacedText.replace(variablePattern, variable.value);
    });
    
    return replacedText;
  }, [variables]);

  // Function to download results as separate markdown files in a ZIP
  const downloadResults = useCallback(async () => {
    // Get all generate nodes with results
    const generateNodes = nodes.filter(node => node.type === 'generate' && node.data.result);
    
    if (generateNodes.length === 0) {
      alert('No AI generator results to download');
      return;
    }

    // Create ZIP file
    const zip = new JSZip();
    
    generateNodes.forEach((node, index) => {
      const nodeName = node.data.variableName || node.data.label || `AIGenerator${index + 1}`;
      // Clean filename (remove special characters)
      const cleanFileName = nodeName.replace(/[^a-zA-Z0-9]/g, '');
      
      // Create markdown content for this specific AI generator
      let markdownContent = `# ${nodeName}\n\n`;
      markdownContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
      
      if (node.data.systemPrompt) {
        const resolvedSystemPrompt = replaceVariables(node.data.systemPrompt, generateNodes, node.id);
        markdownContent += `## System Prompt\n\n${resolvedSystemPrompt}\n\n`;
      }
      
      if (node.data.userPrompt) {
        const resolvedUserPrompt = replaceVariables(node.data.userPrompt, generateNodes, node.id);
        markdownContent += `## User Prompt\n\n${resolvedUserPrompt}\n\n`;
      }
      
      markdownContent += `## Result\n\n${node.data.result}\n`;
      
      // Add file to ZIP
      zip.file(`${cleanFileName}.md`, markdownContent);
    });

    try {
      // Generate ZIP and download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-results-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      alert('Error creating download file');
    }
  }, [nodes, replaceVariables]);

  const formatLogTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'error': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
    }
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 transition-all duration-500 ease-out ${
      isOpen ? 'h-80 w-[400px]' : 'h-12 w-36'
    }`}>
      <div className={`h-full w-full rounded-lg border-2 border-border/60 bg-background/50 shadow-sm backdrop-blur-sm transition-all duration-500 ease-out ${
        isOpen ? 'hover:border-border' : ''
      }`}>
        {/* Console Header */}
        <div className={`flex h-12 items-center px-3 ${isOpen ? 'justify-between border-border/60 border-b' : 'cursor-pointer justify-center transition-colors hover:bg-background/20'}`}
             onClick={!isOpen ? onToggle : undefined}>
          {isOpen ? (
            <>
              <div className='flex flex-1 items-center gap-3'>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className='group h-8 w-8 rounded-lg p-0 transition-all duration-300 hover:bg-background/20'
                >
                  <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <ArrowUpIcon size={16} className='text-gray-700 group-hover:text-foreground dark:text-gray-300' />
                  </div>
                </Button>
                
                <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'edit' | 'results')}>
                  <TabsList className='h-8 border border-border/60 bg-background/40'>
                    <TabsTrigger value="edit" className='px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground'>
                      Edit {selectedNode ? `- ${selectedNode.data.variableName || selectedNode.data.label}` : ''}
                    </TabsTrigger>
                    <TabsTrigger value="results" className='px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground'>
                      Results
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {/* Close button when open */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className='h-8 w-8 rounded-lg p-0 transition-all duration-300 hover:bg-background/20'
              >
                <span className='text-gray-700 text-sm dark:text-gray-300'>✕</span>
              </Button>
            </>
          ) : (
            <div className='pointer-events-none flex items-center gap-2'>
              <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                <ArrowUpIcon size={16} className="text-gray-700 dark:text-gray-300" />
              </div>
              <span className='text-gray-700 text-sm dark:text-gray-300'>Console</span>
            </div>
          )}
        </div>

        {/* Console Content */}
        {isOpen && (
          <div className="h-[calc(100%-3rem)]">
            <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'edit' | 'results')} className="h-full">
              <TabsContent value="edit" className='m-0 h-full overflow-auto p-4'>
              {selectedNode ? (
                <div className="h-full">
                  {selectedNode.type === 'generate' ? (
                    <div className='space-y-4'>
                      {/* Basic Info */}
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="agent-name" className='text-gray-700 text-xs dark:text-gray-300'>Agent Name</Label>
                          <Input
                            id="agent-name"
                            value={currentData.variableName || ''}
                            onChange={(e) => updateLocalData('variableName', e.target.value)}
                            placeholder="Enter agent name"
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className='text-gray-700 text-xs dark:text-gray-300'>AI Model</Label>
                          <Select
                            value={currentData.selectedModel || ''}
                            onValueChange={(value) => updateLocalData('selectedModel', value)}
                          >
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              {chatModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* System Prompt */}
                      <div className="space-y-2">
                        <Label className='text-gray-700 text-xs dark:text-gray-300'>System Prompt</Label>
                        <Textarea
                          value={currentData.systemPrompt || ''}
                          onChange={(e) => updateLocalData('systemPrompt', e.target.value)}
                          placeholder="Enter system instructions..."
                          className="h-[60px] resize-none text-xs"
                        />
                      </div>

                      {/* User Prompt */}
                      <div className="space-y-2">
                        <Label className='text-gray-700 text-xs dark:text-gray-300'>User Prompt</Label>
                        <Textarea
                          value={currentData.userPrompt || ''}
                          onChange={(e) => updateLocalData('userPrompt', e.target.value)}
                          placeholder="Enter user prompt..."
                          className="h-[60px] resize-none text-xs"
                        />
                      </div>
                    </div>
                  ) : selectedNode.type === 'files' ? (
                    <div className="space-y-4">
                      <h3 className='font-medium text-lg'>Files Node</h3>
                      <div className='text-muted-foreground text-sm'>
                        {selectedNode.data.selectedFiles?.length || 0} files selected
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      Unsupported node type
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex h-full items-center justify-center text-muted-foreground'>
                  Select a block to edit its properties
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="results" className='m-0 flex h-full flex-col p-0'>
              {/* Download Button */}
              {uniqueLogs.some(log => log.type === 'success' && log.message.includes('Generation completed')) && (
                <div className='border-border/60 border-b p-3'>
                  <Button
                    onClick={downloadResults}
                    size="sm"
                    className='w-full bg-green-600 text-white hover:bg-green-700'
                  >
                    📦 Download Results (ZIP)
                  </Button>
                </div>
              )}
              
              {/* Logs Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {uniqueLogs.length === 0 ? (
                  <div className='py-12 text-center'>
                    <div className='mb-2 text-muted-foreground text-sm'>No execution logs</div>
                    <div className='text-muted-foreground/60 text-xs'>Run your workflow to see results</div>
                  </div>
                ) : (
                  <div className='min-h-[400px] space-y-1'>
                    {uniqueLogs.map((log, index) => (
                      <div key={`${log.id}-${index}`} className='flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/30'>
                        <div className={`h-2 w-2 flex-shrink-0 rounded-full ${getLogColor(log.type)}`} />
                        <div className='min-w-[60px] font-mono text-muted-foreground text-xs'>
                          {formatLogTime(log.timestamp)}
                        </div>
                        {log.nodeName && (
                          <div className='rounded-sm bg-orange-50 px-2 py-0.5 font-medium text-orange-600 text-xs dark:bg-orange-900/20'>
                            {log.nodeName}
                          </div>
                        )}
                        <div className='flex-1 truncate text-foreground text-sm'>
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
    </div>
  );
}