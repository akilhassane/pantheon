'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for sidebar components
 */
export class SidebarErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sidebar component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center p-8 bg-slate-900 rounded-lg border border-red-500/20">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Something went wrong</h3>
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Loading skeleton for panels
 */
export function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-4 bg-slate-800 rounded w-3/4"></div>
      <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      <div className="h-4 bg-slate-800 rounded w-5/6"></div>
      <div className="space-y-2 mt-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-slate-800 rounded"></div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading spinner
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }

  return (
    <div className={`${sizeClasses[size]} border-blue-500 border-t-transparent rounded-full animate-spin`} />
  )
}
