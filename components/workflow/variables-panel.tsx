'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { AlertCircle, X } from 'lucide-react';

export interface Variable {
  id: string;
  name: string;
  value: string;
  askBeforeRun?: boolean;
  description?: string;
}

interface VariablesPanelProps {
  variables: Variable[];
  onVariablesChange: (variables: Variable[]) => void;
  nodes?: any[]; // Nodes from workflow to check variable usage
}

export function VariablesPanel({ variables, onVariablesChange, nodes = [] }: VariablesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarDescription, setNewVarDescription] = useState('');
  const [newVarAskBeforeRun, setNewVarAskBeforeRun] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    variableId: string;
    variableName: string;
    usedInNodes: Array<{ id: string; label: string; type: string }>;
  } | null>(null);

  const addVariable = () => {
    if (newVarName.trim() && newVarValue.trim()) {
      const newVariable: Variable = {
        id: `var-${Date.now()}`,
        name: newVarName.trim(),
        value: newVarValue.trim(),
        askBeforeRun: newVarAskBeforeRun,
        description: newVarDescription.trim() || undefined,
      };
      onVariablesChange([...variables, newVariable]);
      setNewVarName('');
      setNewVarValue('');
      setNewVarDescription('');
      setNewVarAskBeforeRun(false);
    }
  };

  const updateVariable = (id: string, field: 'name' | 'value' | 'askBeforeRun' | 'description', newValue: string | boolean) => {
    onVariablesChange(
      variables.map(variable =>
        variable.id === id
          ? { ...variable, [field]: newValue }
          : variable
      )
    );
  };

  // Check where a variable is used in the workflow
  const findVariableUsage = (variableName: string): Array<{ id: string; label: string; type: string }> => {
    const usedInNodes: Array<{ id: string; label: string; type: string }> = [];
    const variablePattern = new RegExp(`\\{\\{\\s*${variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');

    nodes.forEach((node) => {
      let isUsed = false;

      // Get the best label for the node - prioritize variableName for all node types
      let nodeLabel = node.data?.variableName;

      // If no variableName, use type-specific defaults
      if (!nodeLabel) {
        if (node.type === 'generate') {
          nodeLabel = 'Generate Node';
        } else if (node.type === 'files') {
          nodeLabel = 'Files Node';
        } else if (node.type === 'note') {
          nodeLabel = node.data?.content?.substring(0, 30) || 'Note Node';
        } else if (node.type === 'decision') {
          nodeLabel = 'Decision Node';
        } else {
          nodeLabel = node.data?.label || node.id;
        }
      }

      const nodeType = node.type || 'unknown';

      // Check in different node properties where variables might be used
      if (node.data?.userPrompt && variablePattern.test(node.data.userPrompt)) {
        isUsed = true;
      }
      if (node.data?.systemPrompt && variablePattern.test(node.data.systemPrompt)) {
        isUsed = true;
      }
      if (node.data?.prompt && variablePattern.test(node.data.prompt)) {
        isUsed = true;
      }
      if (node.data?.content && variablePattern.test(node.data.content)) {
        isUsed = true;
      }

      if (isUsed) {
        usedInNodes.push({ id: node.id, label: nodeLabel, type: nodeType });
      }
    });

    return usedInNodes;
  };

  const handleDeleteClick = (id: string) => {
    const variable = variables.find(v => v.id === id);
    if (!variable) return;

    const usedInNodes = findVariableUsage(variable.name);

    // Always show confirmation modal (whether used or not)
    setDeleteConfirmation({
      variableId: id,
      variableName: variable.name,
      usedInNodes,
    });
  };

  const confirmDelete = () => {
    if (deleteConfirmation) {
      onVariablesChange(variables.filter(variable => variable.id !== deleteConfirmation.variableId));
      setDeleteConfirmation(null);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className='group flex h-8 items-center gap-1.5 rounded-full px-3 transition-all duration-300 hover:scale-105 hover:bg-white/10'
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className='text-sm transition-transform duration-300 group-hover:scale-110'>🔧</span>
        <span className='font-medium text-sm'>Variables ({variables.length})</span>
      </Button>
      
      {isOpen && (
        <Card className='fade-in slide-in-from-top-2 absolute top-full left-0 z-50 mt-3 max-h-[70vh] w-[500px] animate-in overflow-y-auto rounded-xl border border-white/10 bg-background/80 shadow-2xl backdrop-blur-xl duration-300'>
          <CardHeader>
            <CardTitle className="text-sm">Workflow Variables</CardTitle>
          </CardHeader>
          <CardContent>
        
        <div className="space-y-4">
          {/* Add new variable */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add New Variable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="var-name" className="text-xs">Name</Label>
                  <Input
                    id="var-name"
                    placeholder="variable_name"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addVariable()}
                  />
                </div>
                <div>
                  <Label htmlFor="var-value" className="text-xs">Value</Label>
                  <Input
                    id="var-value"
                    placeholder="Variable value"
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addVariable()}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="var-description" className="text-xs">Description (optional)</Label>
                <Textarea
                  id="var-description"
                  placeholder="Décrivez à quoi sert cette variable..."
                  value={newVarDescription}
                  onChange={(e) => setNewVarDescription(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-var-ask-before-run"
                  checked={newVarAskBeforeRun}
                  onCheckedChange={setNewVarAskBeforeRun}
                />
                <Label htmlFor="new-var-ask-before-run" className='cursor-pointer text-xs'>
                  Demander avant le lancement
                </Label>
              </div>
              <Button
                onClick={addVariable}
                disabled={!newVarName.trim() || !newVarValue.trim()}
                className="w-full"
                size="sm"
              >
                <PlusIcon size={14} />
                Add Variable
              </Button>
            </CardContent>
          </Card>

          {/* Variables list */}
          <div className="space-y-2">
            <Label className='font-medium text-sm'>Current Variables</Label>
            {variables.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-muted-foreground text-sm">
                  No variables defined yet. Create variables to use in your prompts with {'{variable_name}'}.
                </CardContent>
              </Card>
            ) : (
              variables.map((variable) => (
                <Card key={variable.id}>
                  <CardContent className="p-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className='grid flex-1 grid-cols-2 gap-3'>
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={variable.name}
                              onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
                              className="h-8"
                            />
                            <div className='mt-1 text-muted-foreground text-xs'>
                              Use: {`{${variable.name}}`}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Value</Label>
                            <Input
                              value={variable.value}
                              onChange={(e) => updateVariable(variable.id, 'value', e.target.value)}
                              className="h-8"
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(variable.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Description (optional)</Label>
                        <Textarea
                          value={variable.description || ''}
                          onChange={(e) => updateVariable(variable.id, 'description', e.target.value)}
                          placeholder="Décrivez à quoi sert cette variable..."
                          className="min-h-[60px] text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2 border-t pt-2">
                        <Switch
                          id={`ask-before-run-${variable.id}`}
                          checked={variable.askBeforeRun || false}
                          onCheckedChange={(checked) => updateVariable(variable.id, 'askBeforeRun', checked)}
                        />
                        <Label htmlFor={`ask-before-run-${variable.id}`} className='cursor-pointer text-xs'>
                          Demander avant le lancement
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmation(null)}
          />

          {/* Modal */}
          <div className="zoom-in-95 relative w-[500px] max-w-[90vw] animate-in overflow-hidden rounded-xl border border-red-500/20 bg-background shadow-2xl duration-200">
            {/* Header */}
            <div className={`flex items-center gap-3 border-b px-5 py-4 ${
              deleteConfirmation.usedInNodes.length > 0
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-orange-500/20 bg-orange-500/5'
            }`}>
              <AlertCircle className={`h-5 w-5 ${
                deleteConfirmation.usedInNodes.length > 0 ? 'text-red-500' : 'text-orange-500'
              }`} />
              <h3 className="flex-1 font-semibold text-sm">
                {deleteConfirmation.usedInNodes.length > 0
                  ? 'Variable en cours d\'utilisation'
                  : 'Confirmer la suppression'}
              </h3>
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 px-5 py-4">
              {deleteConfirmation.usedInNodes.length > 0 ? (
                <>
                  <p className="text-sm leading-relaxed">
                    La variable <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{`{{${deleteConfirmation.variableName}}}`}</span> est utilisée dans <strong>{deleteConfirmation.usedInNodes.length}</strong> bloc{deleteConfirmation.usedInNodes.length > 1 ? 's' : ''} :
                  </p>

                  {/* List of nodes using the variable */}
                  <div className="max-h-[200px] space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                    {deleteConfirmation.usedInNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="flex items-center gap-2 rounded bg-background px-3 py-2 text-xs"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 font-semibold text-[10px] text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {index + 1}
                        </span>
                        <span className="flex-1 font-medium">{node.label}</span>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {node.type}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      ⚠️ Vous devez d'abord retirer cette variable des blocs listés ci-dessus avant de pouvoir la supprimer.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed">
                    Êtes-vous sûr de vouloir supprimer la variable <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{`{{${deleteConfirmation.variableName}}}`}</span> ?
                  </p>
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      ⚠️ Cette action est irréversible.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className='flex gap-2 border-border border-t px-5 py-3'>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmation(null)}
                size="sm"
                className="flex-1"
              >
                Annuler
              </Button>
              {deleteConfirmation.usedInNodes.length === 0 && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    onVariablesChange(variables.filter(variable => variable.id !== deleteConfirmation.variableId));
                    setDeleteConfirmation(null);
                  }}
                  size="sm"
                  className="flex-1"
                >
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}