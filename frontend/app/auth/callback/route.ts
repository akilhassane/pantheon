import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth callback route for OAuth (Supabase and Keycloak)
 * Handles the OAuth callback and redirects appropriately
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  
  // Fix 0.0.0.0 to localhost for proper redirect
  const origin = requestUrl.origin.replace('0.0.0.0', 'localhost')
  
  // Check if this is a Keycloak callback (has 'code' parameter)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    // Keycloak callback - redirect to home with code parameter
    // The frontend will handle the token exchange
    return NextResponse.redirect(`${origin}?code=${code}`)
  }
  
  // Supabase callback or other - redirect to home page where AuthRedirectHandler will process
  return NextResponse.redirect(origin)
}
