'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { HistoryPanelProps, GroupedSessions } from '@/types/sidebar'
import { Session } from '@/types/chat'
import { X, Search, MoreVertical, Edit2, Copy, Trash2, Download } from 'lucide-react'

/**
 * History panel for viewing and managing conversation sessions
 */
export default function HistoryPanel({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onSessionDuplicate
}: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    sessionId: string
    x: number
    y: number
  } | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingSessionId])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu && !(e.target as Element).closest('.context-menu')) {
        setContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const last7Days = new Date(today)
    last7Days.setDate(last7Days.getDate() - 7)

    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      last7days: [],
      older: []
    }

    // Filter sessions by search query
    const filteredSessions = sessions.filter(session => {
      if (!searchQuery.trim()) return true
      
      const query = searchQuery.toLowerCase()
      const nameMatch = session.name.toLowerCase().includes(query)
      const contentMatch = session.chatHistory.some(msg =>
        msg.content.toLowerCase().includes(query)
      )
      
      return nameMatch || contentMatch
    })

    // Group filtered sessions
    filteredSessions.forEach(session => {
      const sessionDate = new Date(session.lastActive)
      
      if (sessionDate >= today) {
        groups.today.push(session)
      } else if (sessionDate >= yesterday) {
        groups.yesterday.push(session)
      } else if (sessionDate >= last7Days) {
        groups.last7days.push(session)
      } else {
        groups.older.push(session)
      }
    })

    // Sort each group by lastActive (descending)
    Object.keys(groups).forEach(key => {
      groups[key as keyof GroupedSessions].sort((a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      )
    })

    return groups
  }, [sessions, searchQuery])

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setContextMenu({
      sessionId,
      x: e.clientX,
      y: e.clientY
    })
  }

  // Handle rename
  const handleRenameClick = (session: Session) => {
    setEditingSessionId(session.id)
    setEditingName(session.name)
    setContextMenu(null)
  }

  const handleRenameSubmit = () => {
    if (editingSessionId && editingName.trim()) {
      onSessionRename(editingSessionId, editingName.trim())
    }
    setEditingSessionId(null)
    setEditingName('')
  }

  const handleRenameCancel = () => {
    setEditingSessionId(null)
    setEditingName('')
  }

  // Handle duplicate
  const handleDuplicateClick = (sessionId: string) => {
    onSessionDuplicate(sessionId)
    setContextMenu(null)
  }

  // Handle delete
  const handleDeleteClick = (sessionId: string) => {
    onSessionDelete(sessionId)
    setContextMenu(null)
  }

  // Handle export
  const handleExportClick = (session: Session) => {
    const dataStr = JSON.stringify(session, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setContextMenu(null)
  }

  // Render session group
  const renderSessionGroup = (title: string, sessions: Session[]) => {
    if (sessions.length === 0) return null

    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase px-4 py-2 sticky top-0 bg-slate-900 z-10">
          {title}
        </h3>
        <div className="space-y-1 px-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`
                group relative px-3 py-2 rounded-lg cursor-pointer transition-colors
                ${session.id === activeSessionId
                  ? 'bg-slate-800 text-white'
                  : 'hover:bg-slate-800/50 text-gray-300'
                }
              `}
              onClick={() => onSessionSelect(session.id)}
              onContextMenu={(e) => handleContextMenu(e, session.id)}
            >
              {editingSessionId === session.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit()
                    if (e.key === 'Escape') handleRenameCancel()
                  }}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate flex-1">
                      {session.name}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleContextMenu(e, session.id)
                      }}
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{session.chatHistory.length} messages</span>
                    <span>•</span>
                    <span>{session.model}</span>
                    <span>•</span>
                    <span>{new Date(session.lastActive).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  const totalResults = Object.values(groupedSessions).reduce((sum, group) => sum + group.length, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-slate-700 z-50 flex flex-col shadow-2xl animate-slide-in-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 id="history-panel-title" className="text-lg font-semibold text-white">
            History
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
            aria-label="Close history panel"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-10 pr-3 py-2 bg-slate-800 text-white placeholder-gray-400 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {searchQuery && (
            <div className="mt-2 text-xs text-gray-400">
              {totalResults} result{totalResults !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
              <Search className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm text-center">
                {searchQuery ? `No sessions found for "${searchQuery}"` : 'No sessions yet'}
              </p>
            </div>
          ) : (
            <>
              {renderSessionGroup('Today', groupedSessions.today)}
              {renderSessionGroup('Yesterday', groupedSessions.yesterday)}
              {renderSessionGroup('Last 7 Days', groupedSessions.last7days)}
              {renderSessionGroup('Older', groupedSessions.older)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-gray-500">
          {sessions.length} total session{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          {(() => {
            const session = sessions.find(s => s.id === contextMenu.sessionId)
            if (!session) return null

            return (
              <>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleRenameClick(session)}
                >
                  <Edit2 className="w-4 h-4" />
                  Rename
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleDuplicateClick(session.id)}
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleExportClick(session)}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => handleDeleteClick(session.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )
          })()}
        </div>
      )}
    </>
  )
}
