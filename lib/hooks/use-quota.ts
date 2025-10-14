import useSWR from 'swr';
import type { UserQuota } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useQuota() {
  const { data, error, mutate } = useSWR<UserQuota>('/api/quota', fetcher, {
    refreshInterval: 30000, // Rafraîchir toutes les 30 secondes
  });

  const updateQuota = async (modelSize: 'small' | 'medium' | 'large') => {
    try {
      const response = await fetch('/api/quota', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelSize }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update quota');
      }

      const updatedQuota = await response.json();
      mutate(updatedQuota, false);
      return updatedQuota;
    } catch (error) {
      console.error('Error updating quota:', error);
      throw error;
    }
  };

  return {
    quota: data,
    isLoading: !error && !data,
    isError: error,
    updateQuota,
    mutate,
  };
}