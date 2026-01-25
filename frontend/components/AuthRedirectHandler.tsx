'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * AuthRedirectHandler
 * 
 * Handles OAuth redirects from Supabase. In production, processes auth tokens.
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
    }
  }, [router])

  return null // This component doesn't render anything
}
