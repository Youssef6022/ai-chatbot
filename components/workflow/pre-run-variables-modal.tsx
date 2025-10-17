'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  const [expandedVariable, setExpandedVariable] = useState<string | null>(null);

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
  if (!isOpen || variablesToAsk.length === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleCancel}
        />

        {/* Modal */}
        <div className='zoom-in-95 relative w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto animate-in rounded-xl border-2 border-border/60 bg-background/95 p-6 shadow-2xl backdrop-blur-sm duration-200'>
          {/* Header */}
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='font-semibold text-lg'>Variables du workflow</h3>
            <button
              onClick={handleCancel}
              className='flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted/30'
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {variablesToAsk.map((variable) => (
              <div key={variable.id} className="flex items-center gap-2 min-w-0">
                <Label className='w-24 flex-shrink-0 font-medium text-muted-foreground text-xs truncate'>
                  {variable.name}
                </Label>
                <input
                  type="text"
                  id={`modal-var-${variable.id}`}
                  value={tempValues[variable.id] || ''}
                  onChange={(e) => setTempValues({
                    ...tempValues,
                    [variable.id]: e.target.value,
                  })}
                  placeholder={`Valeur...`}
                  className='h-9 flex-1 min-w-0 rounded-lg border-2 border-border/60 bg-background px-3 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                />
                {/* Expand button */}
                <button
                  onClick={() => setExpandedVariable(variable.id)}
                  className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50 transition-colors hover:bg-muted'
                  title="Agrandir"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                </button>
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className='flex-1 bg-orange-600 text-white hover:bg-orange-700'
              >
                Lancer le workflow
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded textarea modal */}
      {expandedVariable && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setExpandedVariable(null)}
          />

          <div className='zoom-in-95 relative w-[800px] max-w-[90vw] h-[600px] max-h-[90vh] animate-in rounded-xl border-2 border-border/60 bg-background shadow-2xl duration-200 flex flex-col'>
            {/* Header */}
            <div className='flex items-center justify-between border-b border-border/60 px-6 py-4'>
              <h3 className='font-semibold text-lg'>
                {variablesToAsk.find(v => v.id === expandedVariable)?.name}
              </h3>
              <button
                onClick={() => setExpandedVariable(null)}
                className='flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted/50'
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              <textarea
                value={tempValues[expandedVariable] || ''}
                onChange={(e) => setTempValues({
                  ...tempValues,
                  [expandedVariable]: e.target.value,
                })}
                placeholder={`Entrer la valeur pour ${variablesToAsk.find(v => v.id === expandedVariable)?.name}...`}
                className='h-full w-full resize-none rounded-lg border-2 border-border/60 bg-background px-4 py-3 text-sm transition-all focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
                autoFocus
              />
            </div>

            {/* Footer */}
            <div className="border-t border-border/60 px-6 py-4">
              <Button
                onClick={() => setExpandedVariable(null)}
                className='w-full bg-orange-600 text-white hover:bg-orange-700'
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
