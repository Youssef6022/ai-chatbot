'use client';

import { useState } from 'react';
import type { Workflow } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';

interface WorkflowLibraryClientProps {
  workflows: Workflow[];
}

export function WorkflowLibraryClient({ workflows: initialWorkflows }: WorkflowLibraryClientProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowTitle, setNewWorkflowTitle] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

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


  return (
    <>
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Create Workflow</h1>
        <p className="mx-auto mb-10 max-w-lg text-muted-foreground leading-relaxed">
          Design intelligent chat workflows with AI nodes, custom logic, and powerful automation tools. Transform conversations into seamless experiences.
        </p>
        
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg hover:bg-blue-700"
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
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    try {
                      const workflowData = JSON.parse(e.target?.result as string);
                      window.location.href = `/workflows?import=${encodeURIComponent(JSON.stringify(workflowData))}`;
                    } catch (error) {
                      alert('Erreur lors de la lecture du fichier JSON');
                    }
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-transparent px-6 py-3 text-sm font-medium text-blue-600 transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/20"
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
              <h2 className="text-xl font-semibold text-foreground">Your Workflows</h2>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
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
                    <h3 className="mb-1 truncate text-sm font-medium text-foreground">
                      {workflow.title}
                    </h3>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
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
                        className="cursor-pointer text-xs text-destructive"
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
                    onClick={() => {
                      // TODO: Implement run functionality
                      console.log('Run workflow:', workflow.id);
                    }}
                    className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 text-xs font-medium text-white transition-all hover:bg-green-700"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4z" />
                    </svg>
                    Run
                  </button>
                  <button
                    onClick={() => handleLoadToWorkflow(workflow)}
                    className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 text-xs font-medium text-white transition-all hover:bg-blue-700"
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
                    {formatDistanceToNow(new Date(workflow.createdAt), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
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
    </>
  );
}