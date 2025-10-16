'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variables?: Array<{ name: string; value: string }>;
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

  // Create highlighted HTML
  const createHighlightedText = useCallback((text: string) => {
    const { foundVariables, invalidVariables } = validateVariables(text);
    
    if (foundVariables.length === 0) {
      return text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    }

    let highlightedText = '';
    let lastIndex = 0;

    foundVariables.forEach(variable => {
      // Add text before variable
      highlightedText += text
        .slice(lastIndex, variable.start)
        .replace(/\n/g, '<br>')
        .replace(/ /g, '&nbsp;');

      // Add highlighted variable
      const variableText = text.slice(variable.start, variable.end);
      const isInvalid = invalidVariables.includes(variable.name);
      const colorClass = isInvalid 
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      
      highlightedText += `<span class="rounded px-1 ${colorClass}">${variableText}</span>`;
      
      lastIndex = variable.end;
    });

    // Add remaining text
    highlightedText += text
      .slice(lastIndex)
      .replace(/\n/g, '<br>')
      .replace(/ /g, '&nbsp;');

    return highlightedText;
  }, [validateVariables]);

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
          'pointer-events-none absolute inset-0 z-10 overflow-hidden whitespace-pre-wrap break-words rounded-md bg-transparent px-3 py-2 text-sm text-foreground',
          noBorder ? '' : 'border border-input'
        )}
        style={{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          wordSpacing: 'inherit',
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
        }}
      />
    </div>
  );
}