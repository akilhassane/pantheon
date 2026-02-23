import type { Metadata } from 'next'
import './globals.css'
import { SettingsProvider } from '@/components/settings/SettingsProvider'
import { AuthProvider } from '@/contexts/AuthContext'
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
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            background-color: #0A0A0A !important;
            margin: 0;
            padding: 0;
          }
        `}} />
      </head>
      <body className="font-sans">
        <AuthRedirectHandler />
        <AuthProvider>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </AuthProvider>
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
