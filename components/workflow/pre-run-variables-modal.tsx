'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Variable } from '@/components/workflow/variables-panel';

interface PreRunVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: Variable[];
  onConfirm: (updatedVariables: Variable[]) => void;
}

export function PreRunVariablesModal({
  isOpen,
  onClose,
  variables,
  onConfirm,
}: PreRunVariablesModalProps) {
  const [tempValues, setTempValues] = useState<Record<string, string>>({});

  // Filter to only show variables that should be asked before run
  const variablesToAsk = variables.filter(v => v.askBeforeRun);

  // Initialize temp values when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, string> = {};
      variablesToAsk.forEach(variable => {
        initialValues[variable.id] = variable.value;
      });
      setTempValues(initialValues);
    }
  }, [isOpen, variables]);

  const handleConfirm = () => {
    // Update variables with new values
    const updatedVariables = variables.map(variable => {
      if (variable.askBeforeRun && tempValues[variable.id] !== undefined) {
        return { ...variable, value: tempValues[variable.id] };
      }
      return variable;
    });

    onConfirm(updatedVariables);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // If no variables to ask, don't show the modal
  if (variablesToAsk.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Valeurs des variables</DialogTitle>
          <DialogDescription>
            Veuillez définir les valeurs des variables avant de lancer le workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {variablesToAsk.map((variable) => (
            <div key={variable.id} className="space-y-2">
              <Label htmlFor={`var-${variable.id}`} className="text-sm font-medium">
                {variable.name}
              </Label>
              <Input
                id={`var-${variable.id}`}
                value={tempValues[variable.id] || ''}
                onChange={(e) => setTempValues({
                  ...tempValues,
                  [variable.id]: e.target.value,
                })}
                placeholder={`Entrer la valeur pour ${variable.name}`}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>
            Lancer le workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
