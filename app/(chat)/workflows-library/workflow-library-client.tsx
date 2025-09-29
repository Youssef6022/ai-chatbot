'use client';

import { useState } from 'react';
import { Workflow } from '@/lib/db/schema';
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
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
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
      <div className="bg-card border rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              <span className="font-medium">
                {workflows.length} workflow{workflows.length > 1 ? 's' : ''}
              </span>
            </div>
            {workflows.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Dernière modification: {formatDistanceToNow(new Date(Math.max(...workflows.map(w => new Date(w.updatedAt).getTime()))), { addSuffix: true, locale: fr })}
              </div>
            )}
          </div>
          <Button 
            onClick={() => window.location.href = '/workflows'}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="bg-card border rounded-2xl p-12 text-center shadow-sm">
              <div className="w-24 h-24 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Commencez à créer
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Votre premier workflow vous attend. Automatisez vos tâches et gagnez en productivité.
              </p>
              <Button 
                onClick={() => window.location.href = '/workflows'}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
                size="lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="group relative bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-800"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <Badge 
                      variant={workflow.isPublic ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {workflow.isPublic ? 'Public' : 'Privé'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-1 truncate">
                    {workflow.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {workflow.description || 'Aucune description fournie'}
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleLoadToWorkflow(workflow)} className="cursor-pointer">
                      <Play className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(workflow)} className="cursor-pointer">
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(workflow.id)}
                      className="text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mb-4">
                <Button
                  onClick={() => handleLoadToWorkflow(workflow)}
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDistanceToNow(new Date(workflow.createdAt), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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