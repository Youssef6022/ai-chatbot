'use client';

import { useSupabase } from '@/components/supabase-provider';
import { useRouter } from 'next/navigation';
import { toast } from './toast';

export const SignOutForm = () => {
  const { signOut } = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        type: 'success',
        description: 'Successfully signed out',
      });
      router.push('/');
    } catch (error) {
      toast({
        type: 'error',
        description: 'Error signing out',
      });
    }
  };

  return (
    <button
      type="button"
      className="w-full px-1 py-0.5 text-left text-red-500"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
};