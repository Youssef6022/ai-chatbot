'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Workflow } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Download, Trash2, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Component to handle time display without hydration issues
function TimeAgo({ date }: { date: Date }) {
  const [timeString, setTimeString] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTimeString(formatDistanceToNow(date, { 
        addSuffix: true, 
        locale: fr 
      }));
    };
    updateTime();
    
    // Update every minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!mounted) {
    return <span>...</span>;
  }

  return <span>{timeString}</span>;
}
import { toast } from 'sonner';
import { WorkflowConsole } from '@/components/workflow/workflow-console';
import JSZip from 'jszip';

interface WorkflowLibraryClientProps {
  workflows: Workflow[];
}

export function WorkflowLibraryClient({ workflows: initialWorkflows }: WorkflowLibraryClientProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newWorkflowTitle, setNewWorkflowTitle] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [importedWorkflowData, setImportedWorkflowData] = useState<any>(null);
  
  // Console state
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'warning';
    nodeId?: string;
    nodeName?: string;
    message: string;
  }>>([]);
  const [currentWorkflowNodes, setCurrentWorkflowNodes] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Function to add execution logs
  const addExecutionLog = useCallback((type: 'info' | 'success' | 'error' | 'warning', message: string, nodeId?: string, nodeName?: string) => {
    const log = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      nodeId,
      nodeName,
      message
    };
    setExecutionLogs(prev => [...prev, log]);
  }, []);

  // Function to download results as ZIP
  const downloadResults = useCallback(async () => {
    // Get all generate nodes with results
    const generateNodes = currentWorkflowNodes.filter(node => node.type === 'generate' && node.data.result);
    
    if (generateNodes.length === 0) {
      toast.error('Aucun résultat de génération à télécharger');
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
      
      markdownContent += `## Generated Result\n\n${node.data.result}\n\n`;
      
      // Add configuration info
      markdownContent += `## Configuration\n\n`;
      markdownContent += `- Model: ${node.data.selectedModel || 'chat-model-medium'}\n`;
      markdownContent += `- Search Grounding: ${node.data.isSearchGroundingEnabled ? 'Enabled' : 'Disabled'}\n`;
      markdownContent += `- Thinking Mode: ${node.data.isReasoningEnabled ? 'Enabled' : 'Disabled'}\n`;
      
      // Add to ZIP
      zip.file(`${cleanFileName}.md`, markdownContent);
    });

    // Generate and download ZIP
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workflow-results-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Résultats téléchargés avec succès');
    } catch (error) {
      toast.error('Erreur lors de la création du fichier ZIP');
    }
  }, [currentWorkflowNodes]);

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
    
    // Replace global variables if any (for now we don't have global variables in library)
    // variables.forEach(variable => {
    //   const variablePattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
    //   replacedText = replacedText.replace(variablePattern, variable.value);
    // });
    
    return replacedText;
  }, []);

  // Function to run workflow
  const handleRunWorkflow = async (workflow: Workflow) => {
    if (isRunning) return;
    
    setIsRunning(true);
    setIsConsoleOpen(true);
    setExecutionLogs([]);
    
    addExecutionLog('info', `Exécution du workflow "${workflow.title}" démarrée...`);
    
    try {
      const workflowData = workflow.workflowData;
      
      if (!workflowData || !workflowData.nodes) {
        addExecutionLog('error', 'Données de workflow invalides');
        return;
      }
      
      setCurrentWorkflowNodes(workflowData.nodes);
      
      // Find all generate nodes
      const generateNodes = workflowData.nodes.filter((node: any) => node.type === 'generate');
      
      if (generateNodes.length === 0) {
        addExecutionLog('warning', 'Aucun nœud de génération trouvé dans ce workflow');
        return;
      }
      
      addExecutionLog('info', `${generateNodes.length} nœud(s) de génération trouvé(s)`);
      
      // Execute each generate node
      for (const node of generateNodes) {
        const nodeName = node.data.variableName || node.data.label || 'AI Agent';
        addExecutionLog('info', `Exécution du nœud "${nodeName}"...`, node.id, nodeName);
        
        try {
          // Replace variables in prompts before sending
          const resolvedSystemPrompt = replaceVariables(node.data.systemPrompt || '', generateNodes, node.id);
          const resolvedUserPrompt = replaceVariables(node.data.userPrompt || '', generateNodes, node.id);
          
          // Prepare the prompt data with resolved variables
          const promptData = {
            systemPrompt: resolvedSystemPrompt,
            userPrompt: resolvedUserPrompt,
            model: node.data.selectedModel || 'chat-model-medium',
            isSearchGroundingEnabled: node.data.isSearchGroundingEnabled || false,
            isReasoningEnabled: node.data.isReasoningEnabled || false,
          };
          
          // Call the workflow API
          const response = await fetch('/api/workflow/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(promptData),
          });
          
          if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
          }
          
          const result = await response.text();
          
          // Update the node with the result
          node.data.result = result;
          
          addExecutionLog('success', `Generation completed: ${nodeName}`, node.id, nodeName);
        } catch (error: any) {
          addExecutionLog('error', `Erreur lors de l'exécution du nœud "${nodeName}": ${error.message}`, node.id, nodeName);
        }
      }
      
      addExecutionLog('success', 'Exécution du workflow terminée');
      
      // Update the state to trigger React re-render
      setCurrentWorkflowNodes([...workflowData.nodes]);
      
      // Check if we have results and propose download
      const hasResults = generateNodes.some(node => node.data.result);
      if (hasResults) {
        addExecutionLog('info', 'Résultats disponibles ! Vous pouvez maintenant télécharger le fichier ZIP.');
      }
    } catch (error: any) {
      addExecutionLog('error', `Erreur générale: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDelete = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkflows(workflows.filter(w => w.id !== workflowId));
        toast.success('Workflow supprimé avec succès');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDownload = (workflow: Workflow) => {
    const dataStr = JSON.stringify(workflow.workflowData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `${workflow.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLoadToWorkflow = (workflow: Workflow) => {
    // Rediriger vers la page workflows avec l'ID du workflow
    window.location.href = `/workflows?id=${workflow.id}`;
  };

  const handleCreateWorkflow = () => {
    if (!newWorkflowTitle.trim()) {
      toast.error('Le titre du workflow est requis');
      return;
    }

    // Rediriger vers la page workflows avec les données du nouveau workflow
    const params = new URLSearchParams({
      title: newWorkflowTitle,
      description: newWorkflowDescription
    });
    window.location.href = `/workflows?${params.toString()}`;
  };

  const handleImportWorkflow = () => {
    if (!newWorkflowTitle.trim()) {
      toast.error('Le titre du workflow est requis');
      return;
    }

    if (!importedWorkflowData) {
      toast.error('Aucun workflow à importer');
      return;
    }

    // Rediriger vers la page workflows avec les données du workflow importé et le nouveau nom/description
    const params = new URLSearchParams({
      import: JSON.stringify(importedWorkflowData),
      title: newWorkflowTitle,
      description: newWorkflowDescription
    });
    window.location.href = `/workflows?${params.toString()}`;
  };

  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target?.result as string);
        setImportedWorkflowData(workflowData);
        
        // Pré-remplir avec le nom existant s'il existe
        const existingName = workflowData.metadata?.name || 'Workflow Importé';
        setNewWorkflowTitle(existingName);
        setNewWorkflowDescription('');
        
        setShowImportModal(true);
      } catch (error) {
        toast.error('Erreur lors de la lecture du fichier JSON');
      }
    };
    reader.readAsText(file);
  };


  return (
    <>
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className='mb-6 font-bold text-3xl text-foreground'>Create Workflow</h1>
        <p className="mx-auto mb-10 max-w-lg text-muted-foreground leading-relaxed">
          Design intelligent chat workflows with AI nodes, custom logic, and powerful automation tools. Transform conversations into seamless experiences.
        </p>
        
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-sm text-white shadow-md transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg'
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New
          </button>
          
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  handleFileImport(file);
                }
              };
              input.click();
            }}
            className='inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-transparent px-6 py-3 font-medium text-blue-600 text-sm transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/20'
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import Existing
          </button>
        </div>
      </div>

      {/* Workflows Section */}
      {workflows.length > 0 && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className='font-semibold text-foreground text-xl'>Your Workflows</h2>
              <div className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 text-xs dark:bg-blue-900/30 dark:text-blue-400'>
                {workflows.length}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md dark:hover:border-blue-800"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className='mb-1 truncate font-medium text-foreground text-sm'>
                      {workflow.title}
                    </h3>
                    <p className='line-clamp-2 text-muted-foreground text-xs'>
                      {workflow.description || 'No description provided'}
                    </p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem onClick={() => handleLoadToWorkflow(workflow)} className="cursor-pointer text-xs">
                        <Play className="mr-2 h-3 w-3" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(workflow)} className="cursor-pointer text-xs">
                        <Download className="mr-2 h-3 w-3" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(workflow.id)}
                        className='cursor-pointer text-destructive text-xs'
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Actions */}
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => handleRunWorkflow(workflow)}
                    disabled={isRunning}
                    className='flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 font-medium text-white text-xs transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4z" />
                    </svg>
                    Run
                  </button>
                  <button
                    onClick={() => handleLoadToWorkflow(workflow)}
                    className='flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 font-medium text-white text-xs transition-all hover:bg-blue-700'
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <TimeAgo date={new Date(workflow.createdAt)} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de création de workflow */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouveau workflow</DialogTitle>
            <DialogDescription>
              Donnez un titre et une description à votre nouveau workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                placeholder="Mon nouveau workflow"
                value={newWorkflowTitle}
                onChange={(e) => setNewWorkflowTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleCreateWorkflow();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                placeholder="Description de votre workflow..."
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateModal(false);
                setNewWorkflowTitle('');
                setNewWorkflowDescription('');
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateWorkflow}>
              Créer le workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'import de workflow */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer un workflow</DialogTitle>
            <DialogDescription>
              Donnez un nom et une description à votre workflow importé.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="import-title">Titre</Label>
              <Input
                id="import-title"
                placeholder="Mon workflow importé"
                value={newWorkflowTitle}
                onChange={(e) => setNewWorkflowTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleImportWorkflow();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-description">Description (optionnel)</Label>
              <Textarea
                id="import-description"
                placeholder="Description de votre workflow importé..."
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImportModal(false);
                setNewWorkflowTitle('');
                setNewWorkflowDescription('');
                setImportedWorkflowData(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleImportWorkflow}>
              Importer le workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Console - positioned on page instead of sidebar */}
      <div className={`-translate-x-1/2 fixed bottom-4 left-1/2 z-50 transform transition-all duration-500 ease-out ${
        isConsoleOpen ? 'h-80 w-[400px]' : 'h-12 w-36'
      }`}>
        <WorkflowConsole
          isOpen={isConsoleOpen}
          onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
          executionLogs={executionLogs}
          variables={[]}
          nodes={currentWorkflowNodes}
        />
      </div>
    </>
  );
}