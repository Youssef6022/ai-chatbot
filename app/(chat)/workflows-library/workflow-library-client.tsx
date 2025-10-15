'use client';

import { useState } from 'react';
import type { Workflow } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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


  return (
    <>
      {/* Stats and Actions Bar */}
      <div className='mb-8 rounded-xl border bg-card p-6 shadow-sm'>
        <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
          <div className="flex items-center gap-4">
            <div className='flex items-center gap-2 text-muted-foreground text-sm'>
              <div className='h-2 w-2 rounded-full bg-blue-600' />
              <span className="font-medium">
                {workflows.length} workflow{workflows.length > 1 ? 's' : ''}
              </span>
            </div>
            {workflows.length > 0 && (
              <div className='text-muted-foreground text-xs'>
                Dernière modification: {formatDistanceToNow(new Date(Math.max(...workflows.map(w => new Date(w.updatedAt).getTime()))), { addSuffix: true, locale: fr })}
              </div>
            )}
          </div>
          <Button 
            onClick={() => window.location.href = '/workflows'}
            className='bg-blue-600 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md'
          >
            <svg className='mr-2 h-4 w-4' fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Créer un workflow
          </Button>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {workflows.length === 0 ? (
          <div className="col-span-full">
            <div className='rounded-2xl border bg-card p-12 text-center shadow-sm'>
              <div className='mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted'>
                <svg className='h-12 w-12 text-muted-foreground' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className='mb-2 font-semibold text-foreground text-xl'>
                Commencez à créer
              </h3>
              <p className='mx-auto mb-6 max-w-md text-muted-foreground'>
                Votre premier workflow vous attend. Automatisez vos tâches et gagnez en productivité.
              </p>
              <Button 
                onClick={() => window.location.href = '/workflows'}
                className='bg-blue-600 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md'
                size="lg"
              >
                <svg className='mr-2 h-5 w-5' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer mon premier workflow
              </Button>
            </div>
          </div>
        ) : (
          workflows.map((workflow, index) => (
            <div 
              key={workflow.id} 
              className='group relative rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md dark:hover:border-blue-800'
            >
              {/* Header */}
              <div className='mb-4 flex items-start justify-between'>
                <div className='min-w-0 flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    <div className='h-3 w-3 rounded-full bg-blue-600' />
                    <Badge 
                      variant={workflow.isPublic ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {workflow.isPublic ? 'Public' : 'Privé'}
                    </Badge>
                  </div>
                  <h3 className='mb-1 truncate font-semibold text-foreground text-lg'>
                    {workflow.title}
                  </h3>
                  <p className='line-clamp-2 min-h-[2.5rem] text-muted-foreground text-sm'>
                    {workflow.description || 'Aucune description fournie'}
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className='h-8 w-8 p-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100'
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleLoadToWorkflow(workflow)} className="cursor-pointer">
                      <Play className='mr-2 h-4 w-4' />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(workflow)} className="cursor-pointer">
                      <Download className='mr-2 h-4 w-4' />
                      Télécharger
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(workflow.id)}
                      className='cursor-pointer text-destructive'
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Action Buttons */}
              <div className='mb-4 flex gap-2'>
                <Button
                  onClick={() => handleLoadToWorkflow(workflow)}
                  size="sm"
                  className='flex-1 bg-blue-600 text-white hover:bg-blue-700'
                >
                  <Play className='mr-1 h-3 w-3' />
                  Modifier
                </Button>
              </div>

              {/* Footer */}
              <div className='flex items-center justify-between text-muted-foreground text-xs'>
                <span className="flex items-center gap-1">
                  <svg className='h-3 w-3' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDistanceToNow(new Date(workflow.createdAt), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <svg className='h-3 w-3' fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Modifié {formatDistanceToNow(new Date(workflow.updatedAt), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}