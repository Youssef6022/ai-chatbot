'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowTitle: string;
  executionData: {
    nodes: any[];
    variables: any[];
    executionLogs: any[];
  };
  status: 'success' | 'error' | 'partial';
  createdAt: string;
}

export default function WorkflowHistoryPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflow-executions');
      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      } else {
        console.error('Failed to load executions:', await response.text());
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'error':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      case 'partial':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Succès';
      case 'error':
        return 'Erreur';
      case 'partial':
        return 'Partiel';
      default:
        return status;
    }
  };

  const deleteExecution = async (id: string) => {
    try {
      const response = await fetch(`/api/workflow-executions?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const filtered = executions.filter(e => e.id !== id);
        setExecutions(filtered);
        if (selectedExecution?.id === id) {
          setSelectedExecution(null);
        }
      } else {
        console.error('Failed to delete execution:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting execution:', error);
    }
  };

  return (
    <div className='fixed inset-0 z-50 bg-background'>
      {/* Header */}
      <div className='flex h-16 items-center justify-between border-border border-b bg-background/80 px-6 backdrop-blur-sm'>
        <div className='flex items-center gap-4'>
          <Button
            onClick={() => router.push('/workflows')}
            size="sm"
            variant="ghost"
            className='gap-2'
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Retour
          </Button>
          <div>
            <h1 className='font-semibold text-xl'>Historique des exécutions</h1>
            <p className='text-muted-foreground text-sm'>{executions.length} exécution{executions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='flex h-[calc(100vh-4rem)]'>
        {/* Executions List */}
        <div className='w-96 border-border border-r bg-muted/20 overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center p-8'>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : executions.length === 0 ? (
            <div className='flex flex-col items-center justify-center p-8 text-center'>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground mb-4">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <p className='text-muted-foreground mb-2'>Aucune exécution</p>
              <p className='text-muted-foreground text-sm'>Lancez un workflow pour voir l'historique</p>
            </div>
          ) : (
            <div className='p-4 space-y-2'>
              {executions.map((execution) => (
                <button
                  key={execution.id}
                  onClick={() => setSelectedExecution(execution)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                    selectedExecution?.id === execution.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-border hover:border-blue-300 hover:bg-muted/50'
                  }`}
                >
                  <div className='mb-2 flex items-start justify-between'>
                    <h3 className='font-medium text-sm line-clamp-1'>{execution.workflowTitle}</h3>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(execution.status)}`}>
                      {getStatusLabel(execution.status)}
                    </span>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {formatDate(execution.createdAt)}
                  </p>
                  <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
                    <span>{execution.executionData.nodes.filter(n => n.data?.result).length} résultats</span>
                    <span>•</span>
                    <span>{execution.executionData.executionLogs.length} logs</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Execution Details */}
        <div className='flex-1 overflow-y-auto'>
          {selectedExecution ? (
            <div className='p-6'>
              <div className='mb-6 flex items-start justify-between'>
                <div>
                  <h2 className='mb-2 font-semibold text-2xl'>{selectedExecution.workflowTitle}</h2>
                  <p className='text-muted-foreground'>{formatDate(selectedExecution.createdAt)}</p>
                </div>
                <Button
                  onClick={() => deleteExecution(selectedExecution.id)}
                  size="sm"
                  variant="destructive"
                  className='gap-2'
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Supprimer
                </Button>
              </div>

              {/* Variables */}
              {selectedExecution.executionData.variables.length > 0 && (
                <div className='mb-6'>
                  <h3 className='mb-3 font-medium text-lg'>Variables</h3>
                  <div className='grid gap-3 grid-cols-2'>
                    {selectedExecution.executionData.variables.map((variable, index) => (
                      <div key={index} className='rounded-lg border border-border bg-muted/30 p-3'>
                        <div className='mb-1 font-medium text-sm'>{variable.name}</div>
                        <div className='text-muted-foreground text-xs line-clamp-2'>{variable.value || '(vide)'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Agents Results */}
              <div className='mb-6'>
                <h3 className='mb-3 font-medium text-lg'>Résultats des AI Agents</h3>
                <div className='space-y-3'>
                  {selectedExecution.executionData.nodes
                    .filter(n => (n.type === 'generate' || n.type === 'decision') && n.data?.result)
                    .map((node, index) => (
                      <div key={index} className='rounded-lg border border-border bg-background p-4'>
                        <div className='mb-3 flex items-center justify-between'>
                          <h4 className='font-medium'>{node.data.variableName || `AI Agent ${index + 1}`}</h4>
                          {node.type === 'decision' && node.data.selectedChoice && (
                            <span className='rounded-full bg-green-100 px-3 py-1 font-medium text-green-700 text-sm dark:bg-green-900/30 dark:text-green-300'>
                              {node.data.selectedChoice}
                            </span>
                          )}
                        </div>
                        <div className='mb-3 whitespace-pre-wrap rounded border border-border/50 bg-muted/30 p-3 text-sm'>
                          {node.data.result}
                        </div>
                        {node.data.thinking && (
                          <details className='mt-2'>
                            <summary className='cursor-pointer font-medium text-muted-foreground text-sm'>Thinking</summary>
                            <div className='mt-2 whitespace-pre-wrap rounded border border-border/50 bg-muted/20 p-3 font-mono text-xs'>
                              {node.data.thinking}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Execution Logs */}
              <div>
                <h3 className='mb-3 font-medium text-lg'>Logs d'exécution</h3>
                <div className='space-y-2'>
                  {selectedExecution.executionData.executionLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`rounded border-l-4 p-3 ${
                        log.type === 'error'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : log.type === 'success'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <div className='flex items-start gap-2'>
                        <span className='font-mono text-xs text-muted-foreground'>{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</span>
                        <span className='flex-1 text-sm'>{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className='flex h-full items-center justify-center'>
              <div className='text-center'>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted-foreground mb-4">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                <p className='text-muted-foreground'>Sélectionnez une exécution pour voir les détails</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
