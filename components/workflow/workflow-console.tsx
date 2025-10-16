'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowUpIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { Variable } from './variables-panel';
import JSZip from 'jszip';

interface WorkflowConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
  executionLogs: Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>;
  variables?: Variable[];
  nodes?: any[];
}

export function WorkflowConsole({
  isOpen,
  onToggle,
  executionLogs,
  variables = [],
  nodes = []
}: WorkflowConsoleProps) {

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

    // Add execution logs file
    let logsContent = `# Execution Logs\n\n`;
    logsContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    if (uniqueLogs.length > 0) {
      uniqueLogs.forEach(log => {
        const time = formatLogTime(log.timestamp);
        const type = log.type.toUpperCase();
        const nodeName = log.nodeName ? ` [${log.nodeName}]` : '';
        logsContent += `**${time}** ${type}${nodeName}: ${log.message}\n\n`;
      });
    } else {
      logsContent += `No execution logs recorded.\n`;
    }
    
    zip.file('execution-logs.md', logsContent);

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
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-blue-500';
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
              <div className='flex flex-1 items-center'>
<span className='text-gray-700 text-sm dark:text-gray-300'>Console</span>
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
          <div className="h-[calc(100%-3rem)] flex flex-col p-0">
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
                  <div className='space-y-0.5'>
                    {uniqueLogs.map((log, index) => (
                      <div key={`${log.id}-${index}`} className='flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-muted/20'>
                        <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getLogColor(log.type)}`} />
                        <div className='min-w-[50px] font-mono text-muted-foreground text-[10px]'>
                          {formatLogTime(log.timestamp)}
                        </div>
                        {log.nodeName && (
                          <span className='text-muted-foreground text-[10px] opacity-60'>
                            {log.nodeName}
                          </span>
                        )}
                        <div className='flex-1 truncate text-foreground text-xs'>
                          {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
      )}
      </div>
    </div>
  );
}