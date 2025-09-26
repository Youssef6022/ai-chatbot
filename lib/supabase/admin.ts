import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase Admin avec service role key
 * À utiliser uniquement côté serveur pour les opérations admin
 * comme le Storage qui nécessite de bypasser RLS
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}