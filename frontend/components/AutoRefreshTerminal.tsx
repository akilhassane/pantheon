'use client'

import { useEffect, useRef, useState } from 'react'

interface AutoRefreshTerminalProps {
  projectId: string
  projectName: string
  terminalPort: number
  terminalUrl?: string  // Optional tunnel URL for remote access
  containerId?: string
  operatingSystem?: string
}

export default function AutoRefreshTerminal({
  projectId,
  projectName,
  terminalPort,
  terminalUrl,
  containerId,
  operatingSystem
}: AutoRefreshTerminalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null)

  // Determine final terminal URL - use tunnel URL if available, otherwise localhost
  // Auto-detect protocol for localhost URLs
  const finalTerminalUrl = terminalUrl || (() => {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      // If page is HTTPS, try to use HTTPS for iframe too (may fail for localhost)
      return `https://localhost:${terminalPort}/`
    }
    return `http://localhost:${terminalPort}/`
  })()

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
    
    // Simply mark as loaded when onLoad fires
    // We can't reliably check iframe content due to CORS restrictions
    console.log('========================================')
    console.log('✅ TERMINAL IFRAME LOADED SUCCESSFULLY')
    console.log('   Project Name:', projectName)
    console.log('   Project ID:', projectId)
    console.log('   Container ID:', containerId)
    console.log('   Terminal Port:', terminalPort)
    console.log('   Operating System:', operatingSystem || 'unknown')
    console.log('   Terminal URL from prop:', terminalUrl || 'not set')
    console.log('   Final URL:', finalTerminalUrl)
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
  }

  const handleError = (e: any) => {
    console.error('❌ Terminal iframe failed to load')
    console.error('   Project:', projectName)
    console.error('   Project ID:', projectId)
    console.error('   Port:', terminalPort)
    console.error('   Terminal URL from prop:', terminalUrl || 'not set')
    console.error('   Final URL:', finalTerminalUrl)
    console.error('   Error:', e)
    console.error('   Will retry in 2 seconds...')
  }

  useEffect(() => {
    console.log('📺 Terminal iframe rendered:', {
      src: finalTerminalUrl,
      width: iframeRef.current?.offsetWidth,
      height: iframeRef.current?.offsetHeight,
      display: iframeRef.current?.style.display,
      visibility: iframeRef.current?.style.visibility
    })
  }, [finalTerminalUrl, refreshKey])

  return (
    <iframe
      ref={iframeRef}
      key={`terminal-${projectId}-${terminalPort}-${containerId || 'new'}-${refreshKey}`}
      src={finalTerminalUrl}
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
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  )
}
