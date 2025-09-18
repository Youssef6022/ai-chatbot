import type { User } from '@supabase/supabase-js';

export type UserType = 'guest' | 'regular';

export interface AuthSession {
  user: User & {
    type: UserType;
  };
}

export function getUserType(user: User | null): UserType {
  if (!user) return 'guest';
  return 'regular'; // Pour l'instant, tous les utilisateurs connectés sont 'regular'
}