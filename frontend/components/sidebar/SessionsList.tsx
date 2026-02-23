'use client'

import * as React from 'react'
import { MessageSquare, MoreHorizontal, Copy, Download, Trash2, Edit2 } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Session } from '@/types/session'
import { SessionsListProps } from '@/types/sidebar'

export function SessionsList({
  sessions,
  activeSessionId,
  workspaceId,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename,
}: SessionsListProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')

  const filteredSessions = workspaceId
    ? sessions.filter(s => s.workspaceId === workspaceId)
    : sessions

  const handleRename = (session: Session) => {
    setEditingId(session.id)
    setEditName(session.name)
  }

  const handleSaveRename = (sessionId: string) => {
    if (editName.trim()) {
      onSessionRename(sessionId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const handleDuplicate = async (session: Session) => {
    // Call duplicate API
    try {
      const response = await fetch(`http://localhost:3002/api/sessions/${session.id}/duplicate`, {
        method: 'POST',
      })
      if (response.ok) {
        const { session: newSession } = await response.json()
        console.log('Session duplicated:', newSession)
        // Refresh sessions list
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to duplicate session:', error)
    }
  }

  const handleExport = async (session: Session) => {
    try {
      const response = await fetch(`http://localhost:3002/api/sessions/${session.id}/export`)
      if (response.ok) {
        const { data } = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `session-${session.name}-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export session:', error)
    }
  }

  if (filteredSessions.length === 0) {
    return (
      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
        No sessions yet
      </div>
    )
  }

  return (
    <SidebarMenu>
      {filteredSessions.map((session) => (
        <SidebarMenuItem key={session.id}>
          {editingId === session.id ? (
            <div className="px-2 py-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleSaveRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename(session.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="w-full px-2 py-1 text-sm border rounded"
                autoFocus
              />
            </div>
          ) : (
            <>
              <SidebarMenuButton
                isActive={session.id === activeSessionId}
                onClick={() => onSessionSelect(session.id)}
                tooltip={`PID: ${session.terminalPid} | ${session.workingDirectory}`}
              >
                <MessageSquare className="h-4 w-4" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate font-medium">{session.name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    PID: {session.terminalPid} | {session.chatHistory.length} msgs
                  </span>
                </div>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem onClick={() => handleRename(session)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(session)}>
                    <Copy className="h-4 w-4 mr-2" />
                    <span>Duplicate</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(session)}>
                    <Download className="h-4 w-4 mr-2" />
                    <span>Export</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onSessionDelete(session.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
