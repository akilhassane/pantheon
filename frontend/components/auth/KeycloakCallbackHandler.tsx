'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { keycloakAuth } from '@/lib/keycloak-auth'

/**
 * Handles Keycloak OAuth callback
 * Processes the authorization code and exchanges it for tokens
 */
export function KeycloakCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    
    if (code) {
      console.log('[KeycloakCallbackHandler] Processing authorization code')
      
      keycloakAuth.handleCallback(code)
        .then((session) => {
          console.log('[KeycloakCallbackHandler] Authentication successful', session)
          console.log('[KeycloakCallbackHandler] Session saved to localStorage')
          
          // Save a flag to indicate callback is complete
          sessionStorage.setItem('keycloak_callback_complete', 'true')
          
          // Trigger a custom event to notify the app of the new session
          window.dispatchEvent(new CustomEvent('keycloak-session-updated', { 
            detail: { session } 
          }))
          
          // Remove code from URL without reloading
          window.history.replaceState({}, '', '/')
          
          // Don't reload - let the storage event or custom event handler update the state
          console.log('[KeycloakCallbackHandler] Session saved, waiting for state update')
        })
        .catch((error) => {
          console.error('[KeycloakCallbackHandler] Authentication failed:', error)
          // Redirect to signin on error
          router.push('/auth/signin')
        })
    }
  }, [searchParams, router])

  return null
}
