'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variables?: Array<{ name: string; value: string; type?: 'predefined' | 'global' | 'global-ask' | 'ai' }>;
  onVariableValidation?: (hasInvalidVariables: boolean, invalidVariables: string[]) => void;
  noBorder?: boolean;
}

export function HighlightedTextarea({
  value,
  onChange,
  placeholder,
  className,
  variables = [],
  onVariableValidation,
  noBorder = false
}: HighlightedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Extract variables from text
  const extractVariables = useCallback((text: string) => {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const foundVariables: Array<{ name: string; start: number; end: number }> = [];
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      foundVariables.push({
        name: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return foundVariables;
  }, []);

  // Check which variables are valid/invalid
  const validateVariables = useCallback((text: string) => {
    const foundVariables = extractVariables(text);
    const variableNames = variables.map(v => v.name);
    const invalidVariables: string[] = [];

    foundVariables.forEach(variable => {
      if (!variableNames.includes(variable.name)) {
        invalidVariables.push(variable.name);
      }
    });

    return {
      foundVariables,
      invalidVariables,
      hasInvalidVariables: invalidVariables.length > 0
    };
  }, [variables, extractVariables]);

  // Helper function to escape HTML
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Get color class based on variable type
  const getVariableColorClass = useCallback((variableName: string) => {
    const variableInfo = variables.find(v => v.name === variableName);

    if (!variableInfo) {
      // Invalid variable - orange (same as global-ask)
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    }

    // Return color based on type
    switch (variableInfo.type) {
      case 'predefined':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'global':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'global-ask':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'ai':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    }
  }, [variables]);

  // Create highlighted HTML
  const createHighlightedText = useCallback((text: string) => {
    const { foundVariables, invalidVariables } = validateVariables(text);

    if (foundVariables.length === 0) {
      // Escape HTML and add trailing newline
      return `${escapeHtml(text)}\n`;
    }

    let highlightedText = '';
    let lastIndex = 0;

    foundVariables.forEach(variable => {
      // Add text before variable (escape HTML)
      const beforeText = text.slice(lastIndex, variable.start);
      highlightedText += escapeHtml(beforeText);

      // Add highlighted variable (escape HTML) - always use color based on type
      const variableText = text.slice(variable.start, variable.end);
      const colorClass = getVariableColorClass(variable.name);

      highlightedText += `<span class="rounded ${colorClass}" style="padding: 0 2px; margin: 0 -2px; box-decoration-break: clone; -webkit-box-decoration-break: clone;">${escapeHtml(variableText)}</span>`;

      lastIndex = variable.end;
    });

    // Add remaining text (escape HTML)
    highlightedText += escapeHtml(text.slice(lastIndex));

    // Add trailing newline to match textarea behavior
    highlightedText += '\n';

    return highlightedText;
  }, [validateVariables, getVariableColorClass]);

  // Track previous validation result to prevent infinite loops
  const prevValidationResultRef = useRef<{
    hasInvalidVariables: boolean;
    invalidVariables: string[];
  } | null>(null);

  // Update validation callback only when result changes
  useEffect(() => {
    if (onVariableValidation) {
      const { hasInvalidVariables, invalidVariables } = validateVariables(value);
      
      // Only call callback if result has changed
      const prevResult = prevValidationResultRef.current;
      const resultChanged = !prevResult || 
        prevResult.hasInvalidVariables !== hasInvalidVariables ||
        JSON.stringify(prevResult.invalidVariables) !== JSON.stringify(invalidVariables);
      
      if (resultChanged) {
        prevValidationResultRef.current = { hasInvalidVariables, invalidVariables };
        onVariableValidation(hasInvalidVariables, invalidVariables);
      }
    }
  }, [value, variables, onVariableValidation]);

  // Sync scroll position
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;
      setScrollTop(scrollTop);
      setScrollLeft(scrollLeft);
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      {/* Background highlight layer */}
      <div
        ref={highlightRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-md bg-transparent px-3 py-2 text-foreground text-sm',
          noBorder ? '' : 'border border-input'
        )}
        style={{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          wordSpacing: 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          scrollTop: scrollTop,
          scrollLeft: scrollLeft,
        }}
        dangerouslySetInnerHTML={{
          __html: createHighlightedText(value)
        }}
      />
      
      {/* Textarea overlay */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={cn(
          "relative z-20 w-full resize-none rounded-md bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          "text-transparent caret-black dark:caret-white",
          noBorder ? 'focus-visible:outline-none' : 'border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        style={{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          wordSpacing: 'inherit',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      />
    </div>
  );
}