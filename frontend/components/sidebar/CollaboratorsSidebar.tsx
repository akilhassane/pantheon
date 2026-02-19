'use client'

import * as React from 'react'
import { Users, X, UserPlus, UserMinus, Crown, Search, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Collaborator {
  userId: string
  userName: string
  email?: string
  avatarUrl?: string
  status: 'online' | 'active' | 'offline'
  lastActivity: number
  isOwner?: boolean
  isVisible?: boolean
}

interface CollaboratorsSidebarProps {
  isOpen: boolean
  onClose: () => void
  projectId: string | null
  projectName: string
  collaborators: Collaborator[]
  currentUserId: string
  isOwner: boolean
  onAddCollaborator?: () => void
  onRemoveCollaborator?: (userId: string) => void
  onToggleVisibility?: (userId: string) => void
  onToggleAllVisibility?: (visible: boolean) => void
  width?: number
  onWidthChange?: (width: number) => void
}

export function CollaboratorsSidebar({
  isOpen,
  onClose,
  projectId,
  projectName,
  collaborators,
  currentUserId,
  isOwner,
  onAddCollaborator,
  onRemoveCollaborator,
  onToggleVisibility,
  onToggleAllVisibility,
  width = 320,
  onWidthChange
}: CollaboratorsSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showAllUsers, setShowAllUsers] = React.useState(true)
  const [isResizing, setIsResizing] = React.useState(false)
  const resizeStartX = React.useRef<number>(0)
  const resizeStartWidth = React.useRef<number>(0)

  // Handle resize
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX
      const newWidth = resizeStartWidth.current + deltaX
      
      // Minimum 280px, maximum 600px
      if (newWidth >= 280 && newWidth <= 600 && onWidthChange) {
        onWidthChange(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onWidthChange])

  // Debug: Log collaborators when sidebar opens
  React.useEffect(() => {
    if (isOpen && collaborators.length > 0) {
      console.log('🎨 CollaboratorsSidebar opened with collaborators:')
      collaborators.forEach(c => {
        console.log(`  - ${c.userName} (${c.userId.slice(0, 8)}...):`, {
          isOwner: c.isOwner,
          avatarUrl: c.avatarUrl,
          avatarUrlLast10: c.avatarUrl?.slice(-10),
          isCurrentUser: c.userId === currentUserId
        })
      })
    }
  }, [isOpen, collaborators, currentUserId])

  if (!isOpen || !projectId) return null

  // Filter and sort collaborators
  // 1. Filter based on search and visibility
  const filteredCollaborators = collaborators
    .filter((collaborator) => {
      const matchesSearch = collaborator.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           collaborator.email?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesVisibility = showAllUsers || collaborator.isVisible !== false
      return matchesSearch && matchesVisibility
    })
    // 2. Sort: Current user first, then owner, then others
    .sort((a, b) => {
      // Current user always first
      if (a.userId === currentUserId) return -1
      if (b.userId === currentUserId) return 1
      
      // Then owner
      if (a.isOwner) return -1
      if (b.isOwner) return 1
      
      // Then by name
      return a.userName.localeCompare(b.userName)
    })

  const allVisible = collaborators.every(c => c.isVisible !== false)
  const visibleCount = collaborators.filter(c => c.isVisible !== false).length

  const handleToggleAll = () => {
    const newVisibility = !allVisible
    onToggleAllVisibility?.(newVisibility)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'active':
        return 'bg-blue-500'
      case 'offline':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'active':
        return 'Active'
      case 'offline':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-[#17181F] shadow-2xl z-40 flex flex-col rounded-l-xl overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={(e) => {
          setIsResizing(true)
          resizeStartX.current = e.clientX
          resizeStartWidth.current = width
        }}
        className="absolute left-0 top-0 w-6 h-full cursor-col-resize group z-50"
        style={{
          background: isResizing ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
          transition: 'background-color 150ms'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <div 
          className="absolute left-1/2 -translate-x-1/2 top-1/2 transform -translate-y-1/2 bg-blue-500 rounded-full w-1.5 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-150" 
          style={{ pointerEvents: 'none' }}
        ></div>
      </div>

      {/* Border Line */}
      <div className="absolute left-0 top-1 bottom-1 w-px bg-gray-800"></div>
      
      <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="rounded-tl-xl">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-white" />
              <div>
                <h2 className="text-sm font-semibold text-white">Collaborators</h2>
                <p className="text-xs text-gray-400 truncate">{projectName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#252529] border-gray-700 text-white placeholder-gray-500 focus:border-blue-500"
            />
          </div>

          {/* Visibility Controls (Owner Only) */}
          {isOwner && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleToggleAll}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                >
                  {allVisible ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hide All
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Show All
                    </>
                  )}
                </Button>
                <span className="text-xs text-gray-400">
                  {visibleCount}/{collaborators.length} visible
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    Filter
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#17181F] border-gray-700">
                  <DropdownMenuItem
                    onClick={() => setShowAllUsers(true)}
                    className="text-white hover:bg-gray-800"
                  >
                    Show All Users
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowAllUsers(false)}
                    className="text-white hover:bg-gray-800"
                  >
                    Show Visible Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="border-b border-gray-800"></div>
      </div>

      {/* Collaborators List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredCollaborators.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {searchQuery ? 'No users found' : 'No collaborators yet'}
            </div>
          ) : (
            filteredCollaborators.map((collaborator) => (
              <div
                key={collaborator.userId}
                className="flex items-center justify-between p-3 bg-[#252529] rounded-lg hover:bg-[#2a2a2f] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Status Indicator */}
                  <div className="relative">
                    {collaborator.avatarUrl ? (
                      <img
                        key={`${collaborator.userId}-${collaborator.avatarUrl}`}
                        src={collaborator.avatarUrl}
                        alt={collaborator.userName}
                        className="w-10 h-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          console.error('❌ Failed to load avatar for', collaborator.userName, 'URL:', collaborator.avatarUrl, 'Last 10:', collaborator.avatarUrl?.slice(-10))
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling
                          if (fallback) {
                            fallback.classList.remove('hidden')
                          }
                        }}
                        onLoad={(e) => {
                          const img = e.currentTarget as HTMLImageElement
                          console.log('✅ Avatar loaded for', collaborator.userName, 'URL:', img.src, 'Last 10:', img.src.slice(-10))
                        }}
                      />
                    ) : null}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold ${collaborator.avatarUrl ? 'hidden' : ''}`}>
                      {collaborator.userName.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#252529] ${getStatusColor(
                        collaborator.status
                      )}`}
                    />
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {collaborator.userName}
                      </p>
                      {collaborator.isOwner && (
                        <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      )}
                      {collaborator.userId === currentUserId && (
                        <span className="text-xs text-gray-400">(You)</span>
                      )}
                      {/* Hidden badge - only shown to the user themselves, not to owner */}
                      {collaborator.isVisible === false && collaborator.userId === currentUserId && (
                        <span className="text-xs text-gray-400 border border-gray-600 px-1.5 py-0.5 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {getStatusText(collaborator.status)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons (only for owner and not self) */}
                {isOwner && collaborator.userId !== currentUserId && !collaborator.isOwner && (
                  <div className="flex items-center gap-1">
                    {/* Visibility Toggle */}
                    <button
                      onClick={() => onToggleVisibility?.(collaborator.userId)}
                      className="p-1.5 hover:bg-gray-700 rounded transition-colors group"
                      title={collaborator.isVisible !== false ? 'Hide user' : 'Show user'}
                    >
                      {collaborator.isVisible !== false ? (
                        <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400 group-hover:text-yellow-400" />
                      )}
                    </button>
                    {/* Remove Button */}
                    <button
                      onClick={() => onRemoveCollaborator?.(collaborator.userId)}
                      className="p-1.5 hover:bg-red-900/20 rounded transition-colors group"
                      title="Remove collaborator"
                    >
                      <UserMinus className="h-4 w-4 text-gray-400 group-hover:text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer - Add Collaborator Button */}
      {isOwner && onAddCollaborator && (
        <div className="border-t border-gray-800">
          <div className="p-4">
            <Button
              onClick={onAddCollaborator}
              className="w-full bg-white hover:bg-gray-100 text-black"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2 text-black" />
              Add Collaborator
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="rounded-bl-xl">
        <div className="border-t border-gray-800"></div>
        <div className="p-4 bg-[#17181F]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-lg font-semibold text-white">{collaborators.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Online</p>
              <p className="text-lg font-semibold text-green-500">
                {collaborators.filter((c) => c.status === 'online' || c.status === 'active').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Offline</p>
              <p className="text-lg font-semibold text-gray-500">
                {collaborators.filter((c) => c.status === 'offline').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
