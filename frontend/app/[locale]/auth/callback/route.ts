import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    // Keycloak callback - handled client-side by KeycloakCallbackHandler
    // Just redirect to home with the code, the client will handle token exchange
    return NextResponse.redirect(new URL(`/?code=${code}`, requestUrl.origin))
  }

  // Redirect to home page
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
