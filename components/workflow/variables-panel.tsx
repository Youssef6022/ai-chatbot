'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔧 Variables ({variables.length})
      </Button>
      
      {isOpen && (
        <Card className="absolute top-full left-0 mt-2 w-[500px] max-h-[70vh] overflow-y-auto z-50 shadow-lg">
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
            <Label className="text-sm font-medium">Current Variables</Label>
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
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={variable.name}
                            onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
                            className="h-8"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            Use: {'{' + variable.name + '}'}
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