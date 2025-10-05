'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDownIcon, ArrowUpIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        markdownContent += `## System Prompt\n\n${node.data.systemPrompt}\n\n`;
      }
      
      if (node.data.userPrompt) {
        markdownContent += `## User Prompt\n\n${node.data.userPrompt}\n\n`;
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
  }, [nodes]);

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
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out z-50 ${
      isOpen ? 'h-80 w-[750px]' : 'h-12 w-72'
    }`}>
      <div className={`w-full h-full bg-background/50 backdrop-blur-sm border-2 border-border/60 rounded-lg shadow-sm transition-all duration-500 ease-out ${
        isOpen ? 'hover:border-border' : ''
      }`}>
        {/* Console Header */}
        <div className={`flex items-center justify-between px-4 h-12 ${isOpen ? 'border-b border-border/60' : ''}`}>
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0 hover:bg-background/20 rounded-lg transition-all duration-300 group"
            >
              <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                <ArrowUpIcon size={16} className="text-gray-700 dark:text-gray-300 group-hover:text-foreground" />
              </div>
            </Button>
            
            {isOpen ? (
              <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'edit' | 'results')}>
                <TabsList className="h-8 bg-background/40 border border-border/60">
                  <TabsTrigger value="edit" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground px-3">
                    Edit {selectedNode ? `- ${selectedNode.data.variableName || selectedNode.data.label}` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="results" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground px-3">
                    Results
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <span className="text-sm text-gray-700 dark:text-gray-300">Workflow Console</span>
            )}
          </div>
          
          {/* Close button when open */}
          {isOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0 hover:bg-background/20 rounded-lg transition-all duration-300"
            >
              <span className="text-gray-700 dark:text-gray-300 text-sm">✕</span>
            </Button>
          )}
        </div>

        {/* Console Content */}
        {isOpen && (
          <div className="h-[calc(100%-3rem)]">
            <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'edit' | 'results')} className="h-full">
              <TabsContent value="edit" className="h-full m-0 p-4 overflow-auto">
              {selectedNode ? (
                <div className="h-full">
                  {selectedNode.type === 'generate' ? (
                    <div className="grid grid-cols-3 gap-4 h-full">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="agent-name" className="text-sm text-gray-700 dark:text-gray-300">Agent Name</Label>
                          <Input
                            id="agent-name"
                            value={currentData.variableName || ''}
                            onChange={(e) => updateLocalData('variableName', e.target.value)}
                            placeholder="Enter agent name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-gray-700 dark:text-gray-300">AI Model</Label>
                          <Select
                            value={currentData.selectedModel || ''}
                            onValueChange={(value) => updateLocalData('selectedModel', value)}
                          >
                            <SelectTrigger className="mt-1">
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
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-gray-700 dark:text-gray-300">System Prompt</Label>
                          {variables.length > 0 && (
                            <div className="flex gap-1">
                              {variables.slice(0, 3).map((variable) => (
                                <Button
                                  key={variable.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => insertVariable(variable.name, 'systemPrompt')}
                                >
                                  {variable.name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Textarea
                          value={currentData.systemPrompt || ''}
                          onChange={(e) => updateLocalData('systemPrompt', e.target.value)}
                          placeholder="Enter system instructions..."
                          className="h-[180px] resize-none text-sm"
                        />
                      </div>

                      {/* User Prompt */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-gray-700 dark:text-gray-300">User Prompt</Label>
                          {variables.length > 0 && (
                            <div className="flex gap-1">
                              {variables.slice(0, 3).map((variable) => (
                                <Button
                                  key={variable.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => insertVariable(variable.name, 'userPrompt')}
                                >
                                  {variable.name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Textarea
                          value={currentData.userPrompt || ''}
                          onChange={(e) => updateLocalData('userPrompt', e.target.value)}
                          placeholder="Enter user prompt..."
                          className="h-[180px] resize-none text-sm"
                        />
                      </div>
                    </div>
                  ) : selectedNode.type === 'files' ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Files Node</h3>
                      <div className="text-sm text-muted-foreground">
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
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a block to edit its properties
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="results" className="h-full m-0 p-0 flex flex-col">
              {/* Download Button */}
              {uniqueLogs.some(log => log.type === 'success' && log.message.includes('Generation completed')) && (
                <div className="border-b border-border/60 p-3">
                  <Button
                    onClick={downloadResults}
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    📦 Download Results (ZIP)
                  </Button>
                </div>
              )}
              
              {/* Logs Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {uniqueLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-sm text-muted-foreground mb-2">No execution logs</div>
                    <div className="text-xs text-muted-foreground/60">Run your workflow to see results</div>
                  </div>
                ) : (
                  <div className="space-y-1 min-h-[400px]">
                    {uniqueLogs.map((log, index) => (
                      <div key={`${log.id}-${index}`} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/30 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getLogColor(log.type)}`}></div>
                        <div className="text-xs text-muted-foreground font-mono min-w-[60px]">
                          {formatLogTime(log.timestamp)}
                        </div>
                        {log.nodeName && (
                          <div className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-sm">
                            {log.nodeName}
                          </div>
                        )}
                        <div className="text-sm text-foreground flex-1 truncate">
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