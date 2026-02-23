'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  Folder,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Terminal,
  ChevronRight,
  Circle,
  Share2,
  Users,
  MoreVertical,
  Edit2,
  Trash2,
  LogOut,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Session as ChatSession } from '@/types/chat'
import { Project } from '@/types/session'

// Extend ChatSession with project info
type Session = ChatSession & {
  projectId?: string
}

interface Collaboration {
  projectId: string
  project: Project
  ownerName: string
  myPermissions: 'read' | 'write'
}

// Memoized project item component
const ProjectItem = React.memo(({ 
  project, 
  projectSessions, 
  activeProjectId, 
  activeSessionId,
  onProjectSelect,
  onSessionSelect,
  onContextMenu,
  onShowCreationProgress
}: {
  project: Project
  projectSessions: Session[]
  activeProjectId: string | null
  activeSessionId: string | null
  onProjectSelect: (id: string) => void
  onSessionSelect: (id: string) => void
  onContextMenu: (projectId: string, x: number, y: number) => void
  onShowCreationProgress?: () => void
}) => {
  const isActive = project.id === activeProjectId
  const isCreating = project.is_creating || project.status === 'creating'
  
  return (
    <Collapsible
      key={project.id}
      defaultOpen={isActive} // Only open if this is the active project
      className="group/collapsible"
    >
    <SidebarMenuItem>
      <div className="flex items-center w-full">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={project.id === activeProjectId}
            className="flex-1"
            onClick={() => {
              if (isCreating && onShowCreationProgress) {
                onShowCreationProgress()
              } else {
                onProjectSelect(project.id)
              }
            }}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-white" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate">{project.name}</span>
            {isCreating && (
              <span className="ml-auto text-xs text-white">Creating...</span>
            )}
            {!isCreating && (
              <>
                <span className="ml-auto text-xs text-muted-foreground">
                  {projectSessions.length}
                </span>
                <ChevronRight className="ml-1 h-4 w-4 flex-shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!isCreating && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(project.id, e.clientX, e.clientY)
            }}
            className="p-2 hover:bg-gray-800 rounded h-8 flex items-center justify-center"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>
      {!isCreating && (
        <CollapsibleContent>
          <SidebarMenuSub>
            {projectSessions.map((session) => (
              <SidebarMenuSubItem key={session.id}>
                <SidebarMenuSubButton
                  asChild
                  isActive={session.id === activeSessionId}
                >
                  <button
                    onClick={() => onSessionSelect(session.id)}
                    className="w-full"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{session.name}</span>
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
            {projectSessions.length === 0 && (
              <div className="px-8 py-2 text-xs text-muted-foreground">
                No sessions
              </div>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      )}
    </SidebarMenuItem>
  </Collapsible>
  )
})
ProjectItem.displayName = 'ProjectItem'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  sessions: Session[]
  projects: Project[]
  collaborations: Collaboration[]
  activeSessionId: string | null
  activeProjectId: string | null
  onSessionSelect: (sessionId: string) => void
  onProjectSelect: (projectId: string) => void
  onNewSession: () => void
  onNewSessionForProject: (projectId: string) => void
  onNewProject: () => void
  onShareProject: (projectId: string) => void
  onAddCollaboration: () => void
  onLeaveCollaboration: (projectId: string) => void
  onRenameProject: (projectId: string, newName: string) => void
  onDeleteProject: (projectId: string) => void
  onSearch: () => void
  onSettings: () => void
  onSignOut?: () => void
  onShowCreationProgress?: () => void
  currentUser?: {
    name: string
    email: string
    avatar?: string
  }
}

export function AppSidebar({
  sessions = [],
  projects = [],
  collaborations = [],
  activeSessionId,
  activeProjectId,
  onSessionSelect,
  onProjectSelect,
  onNewSession,
  onNewSessionForProject,
  onNewProject,
  onShareProject,
  onAddCollaboration,
  onLeaveCollaboration,
  onRenameProject,
  onDeleteProject,
  onSearch,
  onSettings,
  onSignOut,
  onShowCreationProgress,
  currentUser,
  ...props
}: AppSidebarProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [contextMenu, setContextMenu] = React.useState<{ projectId: string; x: number; y: number } | null>(null)
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const { open, setOpen } = useSidebar()
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark'>('dark')

  // Memoize expensive computations - only when sidebar is open
  const sessionsByProject = React.useMemo(() => {
    if (!open) return new Map() // Skip computation when collapsed
    
    const map = new Map<string, Session[]>()
    sessions.forEach(session => {
      const projectId = session.projectId || 'default'
      if (!map.has(projectId)) {
        map.set(projectId, [])
      }
      map.get(projectId)!.push(session)
    })
    // Sort sessions by creation date once
    map.forEach((sessions) => {
      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })
    return map
  }, [sessions, open])

  const activeProject = React.useMemo(() => {
    return projects.find(p => p.id === activeProjectId)
  }, [projects, activeProjectId])

  // Optimize theme detection - only run once on mount
  React.useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setCurrentTheme(isDark ? 'dark' : 'light')

    // Use a simpler event listener instead of MutationObserver
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setCurrentTheme(isDark ? 'dark' : 'light')
    }
    
    window.addEventListener('theme-changed', handleThemeChange)
    return () => window.removeEventListener('theme-changed', handleThemeChange)
  }, [])

  // Close user menu when clicking outside
  React.useEffect(() => {
    if (!showUserMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is outside the user menu
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }

    // Add listener with a small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  // Memoize handlers to prevent re-renders
  const handleMouseEnter = React.useCallback(() => {
    setIsHovered(true)
    setOpen(true)
  }, [setOpen])

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false)
    setOpen(false)
  }, [setOpen])

  const handleContextMenu = React.useCallback((projectId: string, x: number, y: number) => {
    setContextMenu({ projectId, x, y })
  }, [])

  return (
    <Sidebar 
      collapsible="icon" 
      {...props}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="rounded-r-xl z-50"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/" className="flex items-center gap-3">
                {/* Logo - always visible, high quality at any size */}
                <div className="flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 w-12 h-12">
                  <Image
                    src={currentTheme === 'dark' ? '/assets/logos/logo-dark.jpg' : '/assets/logos/logo-light.jpg'}
                    alt="Kali Assistant Logo"
                    width={128}
                    height={128}
                    className="object-contain w-full h-full rounded-md"
                    quality={90}
                    priority
                    loading="eager"
                  />
                </div>
                {/* ORDER text - only visible when expanded */}
                <div className="group-data-[collapsible=icon]:hidden">
                  <span className="text-2xl font-bold tracking-wider">PANTHEON</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Quick Actions */}
        <div className="flex flex-col gap-2 p-2 group-data-[collapsible=icon]:items-center">
          <Button
            onClick={onNewProject}
            disabled={!currentUser}
            size="sm"
            className="w-full justify-start group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center bg-transparent hover:bg-gray-800 border-0 disabled:opacity-50 disabled:cursor-not-allowed h-9"
            variant="ghost"
            title={!currentUser ? "Sign in to create projects" : "Create new project"}
          >
            <Plus className="h-5 w-5 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden ml-2">New Project</span>
          </Button>
          <Button
            onClick={onNewSession}
            disabled={!currentUser}
            size="sm"
            className="w-full justify-start group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center bg-transparent hover:bg-gray-800 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            variant="ghost"
            title={!currentUser ? "Sign in to create sessions" : "Create new session"}
          >
            <MessageSquare className="h-4 w-4 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden ml-2">New Session</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:justify-center">
            <Folder className="h-4 w-4 group-data-[collapsible=icon]:block hidden" />
            <span className="group-data-[collapsible=icon]:hidden">Projects</span>
            <SidebarGroupAction 
              onClick={onNewProject} 
              disabled={!currentUser}
              className="group-data-[collapsible=icon]:hidden disabled:opacity-50 disabled:cursor-not-allowed"
              title={!currentUser ? "Sign in to create projects" : "Create new project"}
            >
              <Plus className="h-4 w-4" />
            </SidebarGroupAction>
          </SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
            <SidebarMenu>
              {projects.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    projectSessions={sessionsByProject.get(project.id) || []}
                    activeProjectId={activeProjectId}
                    activeSessionId={activeSessionId}
                    onProjectSelect={onProjectSelect}
                    onSessionSelect={onSessionSelect}
                    onContextMenu={handleContextMenu}
                    onShowCreationProgress={onShowCreationProgress}
                  />
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collaborations Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:justify-center">
            <Users className="h-4 w-4 group-data-[collapsible=icon]:block hidden" />
            <span className="group-data-[collapsible=icon]:hidden">Collaborations</span>
            <SidebarGroupAction onClick={onAddCollaboration} className="group-data-[collapsible=icon]:hidden">
              <Plus className="h-4 w-4" />
            </SidebarGroupAction>
          </SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
            <SidebarMenu>
              {!collaborations || collaborations.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No collaborations yet
                </div>
              ) : (
                collaborations.map((collab) => {
                  const collabSessions = sessionsByProject.get(collab.projectId) || []
                  
                  return (
                    <Collapsible
                      key={collab.projectId}
                      defaultOpen={false} // Don't open by default for faster render
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <div className="flex items-center w-full">
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={collab.projectId === activeProjectId}
                              className="flex-1"
                              onClick={() => onProjectSelect(collab.projectId)}
                            >
                              <Users className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{collab.project?.name || 'Unknown Project'}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {collabSessions.length}
                              </span>
                              <ChevronRight className="ml-1 h-4 w-4 flex-shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setContextMenu({ projectId: collab.projectId, x: e.clientX, y: e.clientY })
                            }}
                            className="p-2 hover:bg-gray-800 rounded h-8 flex items-center justify-center"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            <div className="px-8 py-1 text-xs text-muted-foreground">
                              Owner: {collab.ownerName || 'Unknown'}
                            </div>
                            {collabSessions.map((session) => (
                              <SidebarMenuSubItem key={session.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={session.id === activeSessionId}
                                >
                                  <button
                                    onClick={() => onSessionSelect(session.id)}
                                    className="w-full"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="truncate">{session.name}</span>
                                  </button>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            {collabSessions.length === 0 && (
                              <div className="px-8 py-2 text-xs text-muted-foreground">
                                No sessions
                              </div>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Context Menu - Rendered via Portal to ensure it's on top */}
        {contextMenu && typeof window !== 'undefined' && createPortal(
          (() => {
            // Check if this is a collaboration or owned project
            const isCollaboration = collaborations.some(c => c.projectId === contextMenu.projectId)
            const collaboration = collaborations.find(c => c.projectId === contextMenu.projectId)
            
            return (
              <div
                className="fixed bg-gray-900 border border-gray-700 rounded-md shadow-lg py-1 z-[9999]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onMouseLeave={() => setContextMenu(null)}
              >
                <button
                  onClick={() => {
                    onNewSessionForProject(contextMenu.projectId)
                    setContextMenu(null)
                  }}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Session
                </button>
                
                {!isCollaboration && (
                  <>
                    <button
                      onClick={() => {
                        onShareProject(contextMenu.projectId)
                        setContextMenu(null)
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share Project
                    </button>
                    <button
                      onClick={() => {
                        const newName = prompt('Enter new project name:')
                        if (newName) {
                          onRenameProject(contextMenu.projectId, newName)
                        }
                        setContextMenu(null)
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Rename
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button
                      onClick={() => {
                        onDeleteProject(contextMenu.projectId)
                        setContextMenu(null)
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
                
                {isCollaboration && (
                  <>
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      Owner: {collaboration?.ownerName}
                    </div>
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      Access: {collaboration?.myPermissions === 'write' ? 'Read & Write' : 'Read Only'}
                    </div>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button
                      onClick={() => {
                        onLeaveCollaboration(contextMenu.projectId)
                        setContextMenu(null)
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2 text-orange-500"
                    >
                      <LogOut className="h-4 w-4" />
                      Leave Collaboration
                    </button>
                  </>
                )}
              </div>
            )
          })(),
          document.body
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSettings}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          {/* User Profile */}
          {currentUser && (
            <SidebarMenuItem>
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-2 py-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center w-full"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-sidebar" />
                  </div>
                  
                  {/* User Info (hidden when collapsed) */}
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden text-left">
                    <div className="text-sm font-medium text-white truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </button>
                
                {/* User Menu Dropdown */}
                {showUserMenu && (
                  <div 
                    className="absolute bottom-full left-0 mb-2 w-full bg-gray-900 border border-gray-700 rounded-md shadow-lg py-1 z-50"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        if (onSignOut) onSignOut()
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-gray-800 flex items-center gap-2 text-white"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
