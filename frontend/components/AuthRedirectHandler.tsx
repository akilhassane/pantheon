'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * AuthRedirectHandler
 * 
 * Handles OAuth redirects from Supabase. Processes auth tokens from URL hash.
 * In local Docker development, redirects container hostname to localhost.
 */
export default function AuthRedirectHandler() {
  const router = useRouter()

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    const currentUrl = window.location.href
    const currentHostname = window.location.hostname

    // Check if we're on a production Vercel domain
    const isProduction = currentHostname.includes('vercel.app')

    // Check if we're on a container hostname (not localhost or an IP)
    const isContainerHostname = 
      currentHostname !== 'localhost' &&
      currentHostname !== '127.0.0.1' &&
      !currentHostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/) && // Not an IP address
      !isProduction // Not production

    // Check if URL has auth tokens in the hash
    const hasAuthTokens = window.location.hash.includes('access_token=')

    // Only redirect to localhost if we're in local Docker (not production)
    if (isContainerHostname && hasAuthTokens) {
      // Extract the hash with auth tokens
      const hash = window.location.hash
      
      // Construct the localhost URL with the same path and hash
      const localhostUrl = `http://localhost:3000${window.location.pathname}${hash}`
      
      console.log('🔄 Redirecting from container hostname to localhost:', {
        from: currentUrl,
        to: localhostUrl
      })

      // Redirect to localhost
      window.location.href = localhostUrl
      return
    }

    // Process auth tokens if present in hash (for production and localhost)
    if (hasAuthTokens) {
      console.log('🔐 Processing auth tokens from URL hash')
      
      // Parse the hash parameters
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        console.log('🔑 Setting session with tokens from URL')
        
        // Set the session using the tokens from the URL
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data: { session }, error }) => {
          if (error) {
            console.error('❌ Error setting auth session:', error)
            return
          }
          
          if (session) {
            console.log('✅ Auth session established:', {
              user: session.user.email,
              expiresAt: new Date(session.expires_at! * 1000).toISOString()
            })
            
            // Clean up the URL hash after successful authentication
            window.history.replaceState(null, '', window.location.pathname)
            
            // Refresh the page to update auth state
            router.refresh()
          }
        })
      } else {
        console.warn('⚠️ Auth tokens found in URL but missing access_token or refresh_token')
      }
    }
  }, [router])

  return null // This component doesn't render anything
}
