'use client';

import { useState } from 'react';
import { Workflow } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Eye, Download, Trash2, Edit, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface WorkflowLibraryClientProps {
  workflows: Workflow[];
}

export function WorkflowLibraryClient({ workflows: initialWorkflows }: WorkflowLibraryClientProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showPreview, setShowPreview] = useState(false);

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

  const handlePreview = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setShowPreview(true);
  };

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">
            {workflows.length} workflow{workflows.length > 1 ? 's' : ''} sauvegardé{workflows.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button 
          onClick={() => window.location.href = '/workflows'}
          className="bg-primary hover:bg-primary/90"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Créer un workflow
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground mb-4">Aucun workflow sauvegardé</p>
            <Button 
              onClick={() => window.location.href = '/workflows'}
              className="bg-primary hover:bg-primary/90"
            >
              Créer mon premier workflow
            </Button>
          </div>
        ) : (
          workflows.map((workflow) => (
            <Card key={workflow.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{workflow.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {workflow.description || 'Aucune description'}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreview(workflow)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Prévisualiser
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLoadToWorkflow(workflow)}>
                        <Play className="h-4 w-4 mr-2" />
                        Charger dans l'éditeur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(workflow)}>
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(workflow.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant={workflow.isPublic ? "default" : "secondary"}>
                    {workflow.isPublic ? 'Public' : 'Privé'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(workflow.createdAt), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWorkflow?.title}</DialogTitle>
            <DialogDescription>
              {selectedWorkflow?.description || 'Aucune description'}
            </DialogDescription>
          </DialogHeader>
          {selectedWorkflow && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Données du workflow :</h4>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(selectedWorkflow.workflowData, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}