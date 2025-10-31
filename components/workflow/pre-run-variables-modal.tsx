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
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancel}
        />

        {/* Modal */}
        <div className='zoom-in-95 relative w-[420px] max-w-[90vw] animate-in overflow-hidden rounded-xl border border-border bg-background shadow-xl duration-200'>
          {/* Header */}
          <div className='flex items-center justify-between border-border border-b px-4 py-3'>
            <h3 className='font-medium text-sm'>Context</h3>
            <button
              onClick={handleCancel}
              className='flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted'
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {variablesToAsk.map((variable) => (
                <div key={variable.id} className="space-y-1">
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5'>
                      <Label className='font-medium text-muted-foreground text-xs'>{variable.name}</Label>
                      <span className='rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]'>text</span>
                    </div>
                    <button
                      onClick={() => setExpandedVariable(variable.id)}
                      className='flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted/20'
                      title="Agrandir"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                      </svg>
                    </button>
                  </div>
                  <textarea
                    id={`modal-var-${variable.id}`}
                    value={tempValues[variable.id] || ''}
                    onChange={(e) => setTempValues({
                      ...tempValues,
                      [variable.id]: e.target.value,
                    })}
                    placeholder="Entrez la valeur..."
                    rows={3}
                    className='w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed transition-colors placeholder:text-muted-foreground/50 focus:border-foreground focus:bg-background focus:outline-none'
                  />
                  {variable.description && (
                    <p className='text-muted-foreground text-xs leading-relaxed'>
                      {variable.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className='flex gap-2 border-border border-t px-4 py-3'>
            <Button
              variant="outline"
              onClick={handleCancel}
              size="sm"
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              size="sm"
              className='flex-1'
            >
              Lancer
            </Button>
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

          <div className='zoom-in-95 relative flex h-[600px] max-h-[90vh] w-[800px] max-w-[90vw] animate-in flex-col rounded-xl border-2 border-border/60 bg-background shadow-2xl duration-200'>
            {/* Header */}
            <div className='border-border/60 border-b px-6 py-4'>
              <div className='flex items-center justify-between'>
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
              {variablesToAsk.find(v => v.id === expandedVariable)?.description && (
                <p className='mt-2 text-muted-foreground text-sm'>
                  {variablesToAsk.find(v => v.id === expandedVariable)?.description}
                </p>
              )}
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
            <div className='border-border/60 border-t px-6 py-4'>
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
