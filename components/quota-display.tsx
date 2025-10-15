'use client';

import { useMemo } from 'react';

interface QuotaDisplayProps {
  modelUsage?: {
    small: { used: number; limit: number };
    medium: { used: number; limit: number };
    large: { used: number; limit: number };
  };
}

export function QuotaDisplay({ modelUsage }: QuotaDisplayProps) {
  const quotaText = useMemo(() => {
    if (!modelUsage) {
      return 'Small 0/5000, Medium 0/2000, Large PRO 0/500';
    }

    const small = `Small ${modelUsage.small.used}/${modelUsage.small.limit}`;
    const medium = `Medium ${modelUsage.medium.used}/${modelUsage.medium.limit}`;
    const large = `Large PRO ${modelUsage.large.used}/${modelUsage.large.limit}`;

    return `${small}, ${medium}, ${large}`;
  }, [modelUsage]);

  return (
    <div className='rounded-md bg-muted/30 px-2 py-1 font-mono text-muted-foreground text-xs'>
      {quotaText}
    </div>
  );
}