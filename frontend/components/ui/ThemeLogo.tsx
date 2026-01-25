'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ThemeLogoProps {
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

/**
 * Logo component that automatically switches between light and dark theme versions
 */
export function ThemeLogo({ 
  width = 100, 
  height = 100, 
  className = '',
  priority = false 
}: ThemeLogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return light logo as default during SSR
    return (
      <Image
        src="/assets/logos/logo-light.jpg"
        alt="Kali Assistant Logo"
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    )
  }

  // Determine which logo to use based on theme
  const currentTheme = resolvedTheme || theme
  const logoSrc = currentTheme === 'dark' 
    ? '/assets/logos/logo-dark.jpg' 
    : '/assets/logos/logo-light.jpg'

  return (
    <Image
      src={logoSrc}
      alt="Kali Assistant Logo"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  )
}
