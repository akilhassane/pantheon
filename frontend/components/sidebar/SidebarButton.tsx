'use client'

import React, { useState, useEffect } from 'react'
import { SidebarButtonProps } from '@/types/sidebar'

/**
 * Reusable sidebar button component with tooltip, badge, and active states
 */
export default function SidebarButton({
  icon,
  label,
  isActive = false,
  isDisabled = false,
  badge,
  onClick,
  tooltip,
  href
}: SidebarButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }
    }
  }, [tooltipTimeout])

  const handleMouseEnter = () => {
    // Show tooltip after 500ms delay
    const timeout = setTimeout(() => {
      setShowTooltip(true)
    }, 500)
    setTooltipTimeout(timeout)
  }

  const handleMouseLeave = () => {
    // Cancel tooltip timeout and hide tooltip
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
      setTooltipTimeout(null)
    }
    setShowTooltip(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isDisabled) {
      e.preventDefault()
      return
    }
    onClick()
  }

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false

  const buttonClasses = `
    peer/menu-button flex items-center justify-center gap-2 overflow-hidden rounded-xl 
    text-left outline-none ring-sidebar-ring transition-[width,height,padding] 
    focus-visible:ring-1 [&>span:last-child]:truncate [&>svg]:shrink-0 
    text-sm w-10 h-10 flex-col transition-colors p-1 relative
    ${isActive 
      ? 'text-white bg-slate-800' 
      : 'text-gray-400 border-transparent hover:text-white'
    }
    ${!isDisabled && 'hover:bg-slate-800 active:bg-slate-700'}
    ${isDisabled && 'opacity-50 cursor-not-allowed'}
    ${!prefersReducedMotion && 'transition-all duration-200'}
  `.trim().replace(/\s+/g, ' ')

  const tooltipClasses = `
    absolute left-14 top-1/2 -translate-y-1/2 
    bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap 
    pointer-events-none z-50
    ${showTooltip ? 'opacity-100' : 'opacity-0'}
    ${!prefersReducedMotion && 'transition-opacity duration-200'}
  `.trim().replace(/\s+/g, ' ')

  const content = (
    <>
      <div 
        data-sidebar="icon" 
        className="size-6 flex items-center justify-center shrink-0 transition-transform hover:scale-110"
      >
        {icon}
      </div>
      
      {/* Badge indicator */}
      {badge && (
        <div 
          className="absolute right-[8px] top-[8px]" 
          style={{ opacity: 1 }}
          aria-label={`${badge} notifications`}
        >
          {typeof badge === 'number' ? (
            <div className="rounded-full bg-blue-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center px-1">
              {badge > 99 ? '99+' : badge}
            </div>
          ) : (
            <div className="rounded-full bg-blue-400 size-1.5"></div>
          )}
        </div>
      )}
      
      {/* Tooltip */}
      {(tooltip || label) && (
        <div className={tooltipClasses}>
          {tooltip || label}
        </div>
      )}
    </>
  )

  if (href && !isDisabled) {
    return (
      <div 
        className="relative group/tooltip w-full flex justify-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <a
          href={href}
          className={buttonClasses}
          onClick={handleClick}
          aria-label={label}
          aria-disabled={isDisabled}
          role="button"
          tabIndex={isDisabled ? -1 : 0}
        >
          {content}
        </a>
      </div>
    )
  }

  return (
    <div 
      className="relative group/tooltip w-full flex justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={buttonClasses}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-pressed={isActive}
        type="button"
      >
        {content}
      </button>
    </div>
  )
}
