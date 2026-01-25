'use client'

import { useEffect, useRef, useState } from 'react'

interface AutoRefreshTerminalProps {
  projectId: string
  projectName: string
  terminalPort: number
  containerId?: string
  operatingSystem?: string
}

export default function AutoRefreshTerminal({
  projectId,
  projectName,
  terminalPort,
  containerId,
  operatingSystem
}: AutoRefreshTerminalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null)

  // Note: We removed the periodic connection monitoring because:
  // 1. CORS prevents us from reading iframe content anyway
  // 2. The iframe's onError event will catch actual connection failures
  // 3. Polling every 3 seconds was creating unnecessary noise in logs
  // If the terminal connection drops, the user can manually refresh

  useEffect(() => {
    console.log(`📊 State changed - hasLoadedSuccessfully: ${hasLoadedSuccessfully}, refreshKey: ${refreshKey}`)
    
    // If already loaded successfully, don't start refresh interval
    if (hasLoadedSuccessfully) {
      console.log('✅ Terminal is loaded, not starting refresh interval')
      return
    }

    // Clear any existing intervals first
    if (intervalRef.current) {
      console.log('🧹 Clearing existing refresh interval')
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }

    // Wait 5 seconds before starting the refresh interval
    // This gives the iframe time to load naturally on first render
    console.log('⏱️ Starting 5-second wait before auto-refresh...')
    loadTimeoutRef.current = setTimeout(() => {
      if (!hasLoadedSuccessfully) {
        console.log('⏱️ Terminal did not load within 5 seconds, starting auto-refresh...')
        // Start refresh interval - try every 2 seconds
        intervalRef.current = setInterval(() => {
          setRefreshKey(prev => prev + 1)
        }, 2000)
      } else {
        console.log('✅ Terminal loaded during wait period, skipping auto-refresh')
      }
    }, 5000)

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
        loadTimeoutRef.current = null
      }
    }
  }, [hasLoadedSuccessfully])

  const handleLoad = () => {
    console.log(`🔍 Iframe onLoad fired (refreshKey: ${refreshKey}, hasLoadedSuccessfully: ${hasLoadedSuccessfully})`)
    
    // Check if iframe actually loaded content
    try {
      const iframe = iframeRef.current
      if (!iframe) {
        console.log('⚠️ No iframe ref available')
        return
      }

      // Small delay to let iframe content render
      setTimeout(() => {
        try {
          // Try to access iframe content to verify it's not showing "Connection Closed!"
          let hasConnectionError = false
          
          try {
            const iframeDoc = iframe.contentWindow?.document
            const bodyText = iframeDoc?.body?.innerText || ''
            
            console.log(`📄 Iframe body text length: ${bodyText.length}`)
            
            // If we see "Connection Closed!", don't mark as successfully loaded
            if (bodyText.includes('Connection Closed!')) {
              console.log('⚠️ Iframe loaded but shows "Connection Closed!" - continuing refresh...')
              hasConnectionError = true
            } else {
              console.log('✅ Iframe content looks good (no "Connection Closed!" found)')
            }
          } catch (e) {
            // CORS error - can't check content
            // Assume it's fine if we can't check (iframe loaded successfully)
            console.log('ℹ️ Cannot access iframe content (CORS) - assuming terminal is ready')
          }

          // If no connection error detected, mark as successfully loaded
          if (!hasConnectionError) {
            console.log('========================================')
            console.log('✅ TERMINAL IFRAME LOADED SUCCESSFULLY')
            console.log('   Project Name:', projectName)
            console.log('   Project ID:', projectId)
            console.log('   Container ID:', containerId)
            console.log('   Terminal Port:', terminalPort)
            console.log('   Operating System:', operatingSystem || 'unknown')
            console.log('   URL:', `http://localhost:${terminalPort}/`)
            console.log('   Data is being received - stopping auto-refresh')
            console.log('   Setting hasLoadedSuccessfully to TRUE')
            console.log('========================================')

            setHasLoadedSuccessfully(true)

            // Clear the interval and timeout
            if (intervalRef.current) {
              console.log('🧹 Clearing refresh interval from handleLoad')
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            if (loadTimeoutRef.current) {
              console.log('🧹 Clearing load timeout from handleLoad')
              clearTimeout(loadTimeoutRef.current)
              loadTimeoutRef.current = null
            }
          } else {
            console.log('⚠️ Connection error detected, NOT setting hasLoadedSuccessfully')
          }
        } catch (error) {
          console.error('Error in delayed verification:', error)
          // On error, assume it's loaded to avoid infinite refresh
          console.log('⚠️ Error occurred, setting hasLoadedSuccessfully to TRUE to stop refresh')
          setHasLoadedSuccessfully(true)
        }
      }, 500) // Wait 500ms for content to render
    } catch (error) {
      console.error('Error checking iframe load status:', error)
    }
  }

  const handleError = (e: any) => {
    console.error('❌ Terminal iframe failed to load')
    console.error('   Project:', projectName)
    console.error('   Project ID:', projectId)
    console.error('   Port:', terminalPort)
    console.error('   URL:', `http://localhost:${terminalPort}/`)
    console.error('   Error:', e)
    console.error('   Will retry in 2 seconds...')
  }

  const terminalUrl = `http://localhost:${terminalPort}/`

  return (
    <iframe
      ref={iframeRef}
      key={`terminal-${projectId}-${terminalPort}-${containerId || 'new'}-${refreshKey}`}
      src={terminalUrl}
      className="border-none rounded-lg w-full h-full"
      onLoad={handleLoad}
      onError={handleError}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        minWidth: '100%',
        marginLeft: '0',
        display: 'block',
        visibility: 'visible',
        border: 'none'
      }}
      title={`Terminal (ttyd) - ${projectName}`}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock allow-modals"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  )
}
