'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusIcon, TrashIcon } from '@/components/icons';

export interface Variable {
  id: string;
  name: string;
  value: string;
}

interface VariablesPanelProps {
  variables: Variable[];
  onVariablesChange: (variables: Variable[]) => void;
}

export function VariablesPanel({ variables, onVariablesChange }: VariablesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const addVariable = () => {
    if (newVarName.trim() && newVarValue.trim()) {
      const newVariable: Variable = {
        id: `var-${Date.now()}`,
        name: newVarName.trim(),
        value: newVarValue.trim(),
      };
      onVariablesChange([...variables, newVariable]);
      setNewVarName('');
      setNewVarValue('');
    }
  };

  const updateVariable = (id: string, field: 'name' | 'value', newValue: string) => {
    onVariablesChange(
      variables.map(variable =>
        variable.id === id
          ? { ...variable, [field]: newValue }
          : variable
      )
    );
  };

  const deleteVariable = (id: string) => {
    onVariablesChange(variables.filter(variable => variable.id !== id));
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full h-8 px-3 hover:bg-white/10 hover:scale-105 transition-all duration-300 flex items-center gap-1.5 group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm group-hover:scale-110 transition-transform duration-300">🔧</span>
        <span className="text-sm font-medium">Variables ({variables.length})</span>
      </Button>
      
      {isOpen && (
        <Card className='absolute top-full left-0 z-50 mt-3 max-h-[70vh] w-[500px] overflow-y-auto bg-background/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300'>
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
                        onClick={() => deleteVariable(variable.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <TrashIcon size={14} />
                      </Button>
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
    </div>
  );
}