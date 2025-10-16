import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Always redirect to chat.magistral.ai regardless of environment
      return NextResponse.redirect(`https://chat.magistral.ai${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`https://chat.magistral.ai/auth/auth-code-error`)
}