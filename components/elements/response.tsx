'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useEffect, useState, useRef } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown> & {
  isStreaming?: boolean;
};

export const Response = memo(
  ({ className, isStreaming = false, children, ...props }: ResponseProps) => {
    const [displayedText, setDisplayedText] = useState('');
    const targetTextRef = useRef('');
    const displayedTextRef = useRef('');
    const animationFrameRef = useRef<number>();
    const lastUpdateTimeRef = useRef(Date.now());
    const lastTextLengthRef = useRef(0);

    const targetText = typeof children === 'string' ? children : '';

    useEffect(() => {
      const now = Date.now();
      const textDelta = targetText.length - lastTextLengthRef.current;

      targetTextRef.current = targetText;
      lastUpdateTimeRef.current = now;
      lastTextLengthRef.current = targetText.length;

      // If not streaming, show all text immediately
      if (!isStreaming) {
        setDisplayedText(targetText);
        displayedTextRef.current = targetText;
        return;
      }

      // Calculate adaptive speed based on incoming chunk size
      const baseDelay = 12; // Base delay in ms (faster)
      const charsPerTick = textDelta > 50 ? 10 : textDelta > 20 ? 6 : 4;

      // Clear any existing animation
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }

      // Smooth character-by-character reveal
      const revealNextChars = () => {
        const target = targetTextRef.current;
        const currentDisplayed = displayedTextRef.current;

        if (currentDisplayed.length < target.length) {
          // Adaptively reveal more characters if we're falling behind
          const remainingChars = target.length - currentDisplayed.length;
          const charsToAdd = Math.min(
            remainingChars > 100 ? charsPerTick * 2 : charsPerTick,
            remainingChars
          );

          const newDisplayed = target.slice(0, currentDisplayed.length + charsToAdd);
          displayedTextRef.current = newDisplayed;
          setDisplayedText(newDisplayed);

          // Continue animation with adaptive delay
          animationFrameRef.current = window.setTimeout(revealNextChars, baseDelay);
        }
      };

      revealNextChars();

      return () => {
        if (animationFrameRef.current) {
          clearTimeout(animationFrameRef.current);
        }
      };
    }, [targetText, isStreaming]);

    return (
      <Streamdown
        className={cn(
          'size-full text-left [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_p]:text-left [&_div]:text-left [&_h1]:text-left [&_h2]:text-left [&_h3]:text-left [&_ul]:text-left [&_ol]:text-left',
          className,
        )}
        {...props}
      >
        {isStreaming ? displayedText : children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isStreaming === nextProps.isStreaming,
);

Response.displayName = 'Response';
