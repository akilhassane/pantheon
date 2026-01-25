import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth callback route for Supabase OAuth
 * This route simply redirects to the home page where AuthRedirectHandler
 * will process the tokens from the URL hash
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  
  // Redirect to home page where AuthRedirectHandler will process the auth tokens
  return NextResponse.redirect(requestUrl.origin)
}
