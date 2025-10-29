'use client'

import React, { useState } from 'react'
import RotatingEarth from '@/components/ui/wireframe-dotted-globe'
import { BlurText } from '@/components/ui/animated-blur-text'
import { Terminal } from '@/components/ui/terminal'

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [message, setMessage] = useState('')
  const [showOrderText, setShowOrderText] = useState(true)
  const [gradientOpacity, setGradientOpacity] = useState(1)
  const [fadeInOpacity, setFadeInOpacity] = useState(0)
  const [textDisappearing, setTextDisappearing] = useState(false)
  const [lastInteractionTime, setLastInteractionTime] = useState<number | null>(null)
  const [chatInputRolledDown, setChatInputRolledDown] = useState(false)
  const [protocolFading, setProtocolFading] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [serverUrl] = useState('http://localhost:8811')

  // Auto-start animations on page load for demo
  React.useEffect(() => {
    const autoStartTimer = setTimeout(() => {
      setLastInteractionTime(Date.now())
    }, 500)
    return () => clearTimeout(autoStartTimer)
  }, [])

  React.useEffect(() => {
    // Only start checking inactivity if user has interacted
    if (lastInteractionTime === null) return
    
    const checkInactivity = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteractionTime
      
      // Fade out NEW ORDER text before any animations (at 15 seconds)
      if (timeSinceLastInteraction >= 15000 && protocolFading === false) {
        setProtocolFading(true)
      }
      
      // Roll down chat input 1 second before fade-in (at 19 seconds)
      if (timeSinceLastInteraction >= 19000 && !chatInputRolledDown) {
        setChatInputRolledDown(true)
      }
      
      // Fade in content at 20 seconds
      if (timeSinceLastInteraction >= 20000 && fadeInOpacity === 0) {
        setFadeInOpacity(1)
        clearInterval(checkInactivity)
      }
    }, 100)
    
    return () => {
      clearInterval(checkInactivity)
    }
  }, [lastInteractionTime, chatInputRolledDown, fadeInOpacity, protocolFading])

  // Separate effect for animation timers
  React.useEffect(() => {
    if (fadeInOpacity === 0) return
    
    // Start disappear animation 13 seconds after fade-in (at 33 seconds total)
    const disappearTimer = setTimeout(() => {
      setTextDisappearing(true)
    }, 13000)
    
    // Completely hide after 15 seconds after fade-in (at 35 seconds total)
    const hideTimer = setTimeout(() => {
      setShowOrderText(false)
    }, 15000)
    
    return () => {
      clearTimeout(disappearTimer)
      clearTimeout(hideTimer)
    }
  }, [fadeInOpacity])

  React.useEffect(() => {
    const fadeInterval = setInterval(() => {
      setGradientOpacity((prev) => Math.max(0, prev - 0.001))
    }, 100)
    return () => clearInterval(fadeInterval)
  }, [])

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        // Send message to n8n webhook
        const response = await fetch('https://household.app.n8n.cloud/webhook-test/185db2a5-a3d9-460a-8d19-c36bab30230f', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatInput: message
          })
        });

        if (response.ok) {
          const result = await response.text();
          console.log('Response from n8n:', result);
          // Optionally display the result to the user
          alert('n8n response: ' + result);
        } else {
          console.error('Error sending message to n8n:', response.statusText);
          alert('Error: ' + response.statusText);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error sending message: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputInteraction = () => {
    setLastInteractionTime(Date.now())
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex" style={{ background: `linear-gradient(to top, rgba(0, 102, 255, ${gradientOpacity}), rgba(0, 0, 0, ${gradientOpacity}), rgba(0, 0, 0, ${gradientOpacity}))` }}>
      {/* Sidebar */}
      <div
        className={`group peer md:block text-sidebar-foreground z-[40] print:hidden fixed md:relative transition-all duration-300`}
        data-state="collapsed"
        data-collapsible="icon"
        data-variant="sidebar"
        data-side="left"
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        <div className={`duration-200 inset-y-0 h-svh ${sidebarCollapsed ? 'w-[60px]' : 'w-[288px]'} box-content transition-[left,right,width] ease-linear md:flex block group-data-[collapsible=icon]:w-[60px] start-0 group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)] z-20 bg-slate-950 border-r border-slate-800`}>
          <div data-sidebar="sidebar" className="flex h-full w-full flex-col bg-slate-950">
            {/* Header */}
            <div data-sidebar="header" className="h-16 flex flex-row justify-between items-center gap-0 shrink-0 px-2">
              <a aria-label="Página inicial" className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring relative z-10 block w-fit p-1 mx-0.5 shrink-0 hover:bg-slate-800 rounded-xl" href="/">
                <svg width="35" height="33" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-orange-500 w-[1.75rem] h-[1.75rem]">
                  <path d="M13.2371 21.0407L24.3186 12.8506C24.8619 12.4491 25.6384 12.6057 25.8973 13.2294C27.2597 16.5185 26.651 20.4712 23.9403 23.1851C21.2297 25.8989 17.4581 26.4941 14.0108 25.1386L10.2449 26.8843C15.6463 30.5806 22.2053 29.6665 26.304 25.5601C29.5551 22.3051 30.562 17.8683 29.6205 13.8673L29.629 13.8758C28.2637 7.99809 29.9647 5.64871 33.449 0.844576C33.5314 0.730667 33.6139 0.616757 33.6964 0.5L29.1113 5.09055V5.07631L13.2343 21.0436" fill="currentColor" id="mark"></path>
                  <path d="M10.9503 23.0313C7.07343 19.3235 7.74185 13.5853 11.0498 10.2763C13.4959 7.82722 17.5036 6.82767 21.0021 8.2971L24.7595 6.55998C24.0826 6.07017 23.215 5.54334 22.2195 5.17313C17.7198 3.31926 12.3326 4.24192 8.67479 7.90126C5.15635 11.4239 4.0499 16.8403 5.94992 21.4622C7.36924 24.9165 5.04257 27.3598 2.69884 29.826C1.86829 30.7002 1.0349 31.5745 0.36364 32.5L10.9474 23.0341" fill="currentColor" id="mark"></path>
                </svg>
              </a>
            </div>

            {/* Content */}
            <div data-sidebar="content" className="flex min-h-0 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden grow relative overflow-x-hidden">
              {/* Search */}
              <div data-sidebar="group" className="relative w-full min-w-0 flex-col px-1.5 shrink-0 transition-[width,transform,opacity] duration-200 h-10 flex justify-center py-1">
                <div className="relative group/tooltip">
                  <button data-sidebar="menu-button" className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 px-2 rounded-full border border-slate-700 bg-slate-800 text-white h-10 mx-1" aria-label="Buscar">
                    <div className="flex items-center justify-center size-5 shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                        <path d="M17.5 17L20.5 20" stroke="currentColor" strokeLinecap="square"></path>
                        <circle cx="11.25" cy="10.75" r="7.75" stroke="currentColor"></circle>
                      </svg>
                    </div>
                  </button>
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Search</div>
                </div>
              </div>

              {/* Home */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <a className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-white bg-slate-800" href="/">
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                            <path d="M10 4V4C8.13623 4 7.20435 4 6.46927 4.30448C5.48915 4.71046 4.71046 5.48915 4.30448 6.46927C4 7.20435 4 8.13623 4 10V13.6C4 15.8402 4 16.9603 4.43597 17.816C4.81947 18.5686 5.43139 19.1805 6.18404 19.564C7.03968 20 8.15979 20 10.4 20H14C15.8638 20 16.7956 20 17.5307 19.6955C18.5108 19.2895 19.2895 18.5108 19.6955 17.5307C20 16.7956 20 15.8638 20 14V14" stroke="currentColor" strokeLinecap="square"></path>
                            <path d="M12.4393 14.5607L19.5 7.5C20.3284 6.67157 20.3284 5.32843 19.5 4.5C18.6716 3.67157 17.3284 3.67157 16.5 4.5L9.43934 11.5607C9.15804 11.842 9 12.2235 9 12.6213V15H11.3787C11.7765 15 12.158 14.842 12.4393 14.5607Z" stroke="currentColor" strokeLinecap="square"></path>
                          </svg>
                        </div>
                      </a>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Home</div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Voice */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <a className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-gray-400 border-transparent hover:text-white" href="/?voice=true">
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 10v3"></path>
                            <path d="M6 6v11"></path>
                            <path d="M10 3v18"></path>
                            <path d="M14 8v7"></path>
                            <path d="M18 5v13"></path>
                            <path d="M22 10v3"></path>
                          </svg>
                        </div>
                      </a>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Voice</div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Imagine */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <a className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-gray-400 border-transparent hover:text-white" href="/imagine">
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                            <rect width="16" height="16" x="4" y="4" stroke="currentColor" rx="4"></rect>
                            <path stroke="currentColor" d="M4 12a5 5 0 0 1 6 8"></path>
                            <circle cx="15.25" cy="8.75" r="1.75" fill="currentColor"></circle>
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M4 16.5c2.333-.5 8-.5 9-2S11 13 11 13"></path>
                          </svg>
                        </div>
                      </a>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Imagine</div>
                      <div className="absolute right-[15px] top-[8px]" style={{ opacity: 1 }}>
                        <div className="rounded-full bg-blue-400 size-1.5"></div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Terminal */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <button
                        onClick={() => setTerminalOpen(true)}
                        className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-green-400 border-transparent hover:text-green-300"
                      >
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </div>
                      </button>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Kali Terminal</div>
                      <div className="absolute right-[15px] top-[8px]" style={{ opacity: 1 }}>
                        <div className="rounded-full bg-green-400 size-1.5"></div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Project */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <a className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-gray-400 border-transparent hover:text-white" href="/project">
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                            <path d="M3.6665 15.6666V4.33331H7.99984L11.9998 6.33331H20.3332V15.6666C20.3332 17.8758 18.5423 19.6666 16.3332 19.6666H7.6665C5.45736 19.6666 3.6665 17.8758 3.6665 15.6666Z" stroke="currentColor"></path>
                            <path d="M3 11H21" stroke="currentColor"></path>
                          </svg>
                        </div>
                      </a>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">Project</div>
                    </div>
                  </li>
                </ul>
              </div>

              {/* History */}
              <div data-sidebar="group" className="relative flex w-full min-w-0 flex-col px-1.5 py-1 shrink-0 transition-[width,transform,opacity] duration-200">
                <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col cursor-default gap-px">
                  <li data-sidebar="menu-item" className="group/menu-item whitespace-nowrap font-semibold mx-1 relative flex justify-center">
                    <div className="relative group/tooltip w-full flex justify-center">
                      <a className="peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 hover:text-white text-sm hover:bg-slate-800 active:bg-slate-700 w-10 h-10 flex-col transition-colors p-1 text-gray-400 border-transparent hover:text-white" href="/history?tab=conversations">
                        <div data-sidebar="icon" className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                            <path d="M4.4999 3L4.4999 8H9.49988M4.4999 7.99645C5.93133 5.3205 8.75302 3.5 11.9999 3.5C16.6943 3.5 20.4999 7.30558 20.4999 12C20.4999 16.6944 16.6943 20.5 11.9999 20.5C7.6438 20.5 4.05303 17.2232 3.55811 13" stroke="currentColor"></path>
                            <path d="M15 9L12 12V16" stroke="currentColor"></path>
                          </svg>
                        </div>
                      </a>
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">History</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div data-sidebar="footer" className="flex flex-col gap-2 mt-auto relative shrink-0 h-24 px-1.5 py-3">
              <button className="flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-100 [&_svg]:shrink-0 select-none text-white hover:bg-slate-800 disabled:hover:bg-transparent border border-transparent h-10 w-10 flex p-1 rounded-full">
                <span className="relative flex shrink-0 overflow-hidden rounded-full border border-slate-700 hover:opacity-75 transition-[opacity,width,height] duration-150 w-8 h-8">
                  <img className="aspect-square h-full w-full" alt="pfp" src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Globe + Chat */}
      <div className="flex-1 relative overflow-hidden" style={{ opacity: fadeInOpacity, transition: 'opacity 1s ease-in-out' }}>
        {/* Giant Order Text - Render First */}
        {showOrderText && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50" style={{ marginLeft: sidebarCollapsed ? '20px' : '100px', transform: `translate(-50%, calc(-50% - 40px))` }}>
            <div className="flex flex-col items-center">
              <BlurText
                text="create"
                delay={100}
                initialDelay={0}
                animateBy="words"
                direction="top"
                className="text-2xl font-light text-white"
                animationFrom={textDisappearing ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: -50 }}
                animationTo={textDisappearing ? [
                  { filter: "blur(5px)", opacity: 0.5, y: -25 },
                  { filter: "blur(10px)", opacity: 0, y: -50 }
                ] : [
                  { filter: "blur(5px)", opacity: 0.5, y: -25 },
                  { filter: "blur(0px)", opacity: 1, y: 0 }
                ]}
                style={{ marginBottom: '2px' }}
              />
              <BlurText
                text="ORDER"
                delay={150}
                initialDelay={0}
                animateBy="words"
                direction="top"
                className="text-9xl font-black text-white"
                stepDuration={0.5}
                animationFrom={textDisappearing ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: -50 }}
                animationTo={textDisappearing ? [
                  { filter: "blur(5px)", opacity: 0.5, y: -25 },
                  { filter: "blur(10px)", opacity: 0, y: -50 }
                ] : [
                  { filter: "blur(5px)", opacity: 0.5, y: -25 },
                  { filter: "blur(0px)", opacity: 1, y: 0 }
                ]}
              />
            </div>
          </div>
        )}

        {/* Globe - Full Background (Renders after text) */}
        <div className="absolute inset-0 z-0">
          <RotatingEarth width={typeof window !== 'undefined' ? window.innerWidth - 80 : 1840} height={typeof window !== 'undefined' ? window.innerHeight : 1080} />
        </div>
      </div>

      {/* Chat Interface Overlay - OUTSIDE of fadeInOpacity */}
      <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-end px-4 py-8 text-white pointer-events-none">
        <div className={`flex flex-col gap-0 justify-center w-full relative items-center xl:w-4/5 pb-8 pointer-events-auto ${chatInputRolledDown ? 'chat-input-rolldown' : 'chat-input-initial'}`}>
          <input className="hidden" multiple type="file" name="files" />

          {/* Protocol Text - Above Chat Input */}
          {showOrderText && (
            <div className="mb-4 text-6xl transition-opacity duration-1000 text-white" style={{ 
              opacity: protocolFading ? 0 : 1,
              textShadow: '0 0 10px rgba(0, 102, 255, 0.4)',
              filter: 'drop-shadow(0 0 8px rgba(0, 102, 255, 0.3))',
              fontWeight: '900',
              letterSpacing: '-0.02em',
              fontFamily: 'SF Pro Display Heavy, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
            }}>
              NEW ORDER
            </div>
          )}

            {/* Query Bar */}
            <div
              className="rounded-t-[10rem] rounded-b-[10rem] query-bar group z-10 bg-slate-800/90 backdrop-blur-sm ring-slate-700 hover:ring-slate-700 focus-within:ring-slate-700 hover:focus-within:ring-slate-700 relative w-full overflow-hidden shadow-sm max-w-4xl ring-1 ring-inset pb-0 shadow-black/5"
              style={{ transitionProperty: 'background-color, box-shadow, border-color', transitionDuration: '100ms' }}
            >
              <div className="px-12 ps-11 pe-20">
                <div className="relative z-10">
                  <textarea
                    dir="auto"
                    aria-label="Pergunte ao Grok qualquer coisa"
                    placeholder="O que você quer saber?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onInput={handleInputInteraction}
                    className="w-full px-2 leading-7 bg-transparent focus:outline-none text-white align-bottom min-h-14 py-4 my-0 mb-0"
                    style={{ resize: 'none', height: '60px !important' }}
                  />
                </div>

                <div className="flex gap-1.5 absolute inset-x-0 bottom-0 border-2 border-transparent p-2 max-w-full">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-colors duration-100 select-none text-white hover:bg-slate-700 border border-transparent h-10 w-10 rounded-full"
                    aria-label="Anexar"
                    tabIndex={0}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="stroke-[2] text-orange-500"
                    >
                      <path d="M10 9V15C10 16.1046 10.8954 17 12 17V17C13.1046 17 14 16.1046 14 15V7C14 4.79086 12.2091 3 10 3V3C7.79086 3 6 4.79086 6 7V15C6 18.3137 8.68629 21 12 21V21C15.3137 21 18 18.3137 18 15V8" stroke="currentColor"></path>
                    </svg>
                  </button>

                  <div className="ms-auto">
                    {message.trim() ? (
                      <button
                        type="submit"
                        onClick={handleSendMessage}
                        className="group flex flex-col justify-center rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Enviar"
                        tabIndex={0}
                      >
                        <div className="h-10 relative aspect-square flex flex-col items-center justify-center rounded-full ring-1 ring-inset duration-100 before:absolute before:inset-0 before:rounded-full before:bg-white before:ring-0 before:transition-[clip-path,background-color] bg-white text-black ring-transparent before:[clip-path:circle(50%_at_50%_50%)]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2] relative">
                            <path d="M5 11L12 4M12 4L19 11M12 4V21" stroke="currentColor"></path>
                          </svg>
                        </div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="group flex flex-col justify-center rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Entrar no modo de voz"
                        tabIndex={0}
                      >
                        <div className="h-10 relative aspect-square flex items-center justify-center gap-0.5 rounded-full ring-1 ring-inset duration-100 before:absolute before:inset-0 before:rounded-full before:bg-white before:ring-0 before:transition-all bg-white text-black ring-transparent before:[clip-path:circle(50%_at_50%_50%)]">
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '0.4rem' }}></div>
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '0.8rem' }}></div>
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '1.2rem' }}></div>
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '0.7rem' }}></div>
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '1rem' }}></div>
                          <div className="w-0.5 relative z-10 rounded-full bg-black" style={{ height: '0.4rem' }}></div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>

    {/* Terminal Modal */}
    <Terminal 
      isOpen={terminalOpen}
      onClose={() => setTerminalOpen(false)}
      serverUrl={serverUrl}
    />
  )
}
