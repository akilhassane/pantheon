import type { Metadata } from 'next'
import './globals.css'
import { SettingsProvider } from '@/components/settings/SettingsProvider'
import AuthRedirectHandler from '@/components/AuthRedirectHandler'

export const metadata: Metadata = {
  title: 'PANTHEON',
  description: 'AI-powered Agentic Assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <AuthRedirectHandler />
        <SettingsProvider>
          {children}
        </SettingsProvider>
        {/* Invisible credit text */}
        <div 
          style={{
            position: 'fixed',
            bottom: '4px',
            right: '4px',
            fontSize: '1px',
            opacity: '0.01',
            color: 'transparent',
            zIndex: 9999,
            width: '1px',
            height: '1px',
            overflow: 'hidden'
          }}
          aria-hidden="true"
        >
          Created by Akil Harune Ibraimo Hassane
        </div>
      </body>
    </html>
  )
}
