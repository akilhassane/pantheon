'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { keycloakAuth } from '@/lib/keycloak-auth'
import { LogIn, LogOut } from 'lucide-react'

interface SignInButtonProps {
  user: any | null
  onSignOut?: () => void
}

export function SignInButton({ user, onSignOut }: SignInButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSignIn = () => {
    // Redirect to dedicated sign-in page
    router.push('/auth/signin')
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await keycloakAuth.signOut()
      
      // Clear local storage
      localStorage.clear()
      
      // Call parent callback
      if (onSignOut) {
        onSignOut()
      }
      
      // Reload page to reset state
      window.location.reload()
    } catch (error) {
      console.error('Sign out error:', error)
      alert('Failed to sign out. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (user) {
    return (
      <button
        onClick={handleSignOut}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
    >
      <LogIn className="h-4 w-4" />
      <span>Sign In</span>
    </button>
  )
}
