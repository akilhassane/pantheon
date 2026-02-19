import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    // Check if this is a Keycloak callback
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL
    const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM
    
    if (keycloakUrl && keycloakRealm) {
      // Keycloak callback - handled client-side
      // Just redirect to home, the client will handle token exchange
      return NextResponse.redirect(new URL(`/?code=${code}`, requestUrl.origin))
    }
    
    // Supabase callback
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to home page
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
