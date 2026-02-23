'use client'

import { useState, useEffect } from 'react'
import { userSettingsService } from '@/utils/userSettingsService'
import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Plus, Edit2, Save, X, Search, CheckCircle2 } from 'lucide-react'
import { keycloakAuth } from '@/lib/keycloak-auth'
import { useAuth } from '@/contexts/AuthContext'

interface CustomMode {
  id: string
  name: string
  description: string
  systemPrompt: string
  createdAt: number
  user_id?: string
  created_at?: string
  updated_at?: string
  system_prompt?: string
}

export function ModesSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [customModes, setCustomModes] = useState<CustomMode[]>([])
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(256) // 256px = w-64
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useState<HTMLDivElement | null>(null)[0]
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    systemPrompt: ''
  })

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      // Get the container's left offset
      const container = document.querySelector('.modes-settings-container')
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      
      // Min width: 200px, Max width: 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Load custom modes from Supabase
  useEffect(() => {
    loadCustomModes()
    // Load settings to get default mode
    const loadSettings = async () => {
      if (!user?.id) {
        setSettings(DEFAULT_SETTINGS)
        return
      }
      const loaded = await userSettingsService.load(user.id)
      setSettings(loaded)
    }
    loadSettings()
    
    // Listen for storage changes to reload modes in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings') {
        console.log('🔄 [ModesSettings] Settings changed, reloading...')
        loadSettings()
        loadCustomModes()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const loadCustomModes = async () => {
    try {
      setIsLoading(true)
      
      // Get current user from Keycloak auth
      const session = await keycloakAuth.getSession()
      
      if (!session?.user) {
        console.log('No user logged in, loading from localStorage')
        // Fallback to localStorage if not logged in
        const loaded = await userSettingsService.load('guest')
        const modes = (loaded as any).customModes || []
        setCustomModes(modes)
        if (modes.length > 0 && !selectedModeId) {
          setSelectedModeId(modes[0].id)
        }
        setIsLoading(false)
        return
      }

      // Fetch custom modes from backend API (local database)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/custom-modes?userId=${session.user.id}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load custom modes: ${response.statusText}`)
      }

      const { modes: data } = await response.json()

      // Transform backend data to match our interface
      const modes: CustomMode[] = (data || []).map((mode: any) => ({
        id: mode.id,
        name: mode.name,
        description: mode.description || '',
        systemPrompt: mode.system_prompt,
        createdAt: new Date(mode.created_at).getTime(),
        user_id: mode.user_id,
        created_at: mode.created_at,
        updated_at: mode.updated_at
      }))

      setCustomModes(modes)
      
      // Also sync to localStorage for offline access
      if (session?.user?.id) {
        await userSettingsService.update(session.user.id, 'customModes', modes)
      }
      
      if (modes.length > 0 && !selectedModeId) {
        setSelectedModeId(modes[0].id)
      }
    } catch (error) {
      console.error('Failed to load custom modes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = async (path: string, value: any) => {
    if (!user?.id) {
      console.warn('⚠️ No user ID, cannot save settings')
      return
    }
    const updated = await userSettingsService.update(user.id, path, value)
    setSettings(updated)
  }

  const handleCreateMode = async () => {
    try {
      setIsSaving(true)
      
      // Get current user from Keycloak auth
      const session = await keycloakAuth.getSession()
      
      if (!session?.user) {
        // Fallback to localStorage if not logged in
        const newMode: CustomMode = {
          id: `mode-${Date.now()}`,
          name: 'New Mode',
          description: '',
          systemPrompt: '',
          createdAt: Date.now()
        }
        
        const updatedModes = [...customModes, newMode]
        setCustomModes(updatedModes)
        updateSetting('customModes', updatedModes)
        setSelectedModeId(newMode.id)
        setIsEditing(true)
        setEditForm({
          name: newMode.name,
          description: newMode.description,
          systemPrompt: newMode.systemPrompt
        })
        return
      }

      // Create via backend API (local database)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/custom-modes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.user.id,
          name: 'New Mode',
          description: '',
          systemPrompt: ''
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create mode: ${response.statusText}`)
      }

      const { mode: data } = await response.json()

      // Transform and add to local state
      const newMode: CustomMode = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        systemPrompt: data.system_prompt,
        createdAt: new Date(data.created_at).getTime(),
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at
      }

      const updatedModes = [newMode, ...customModes]
      setCustomModes(updatedModes)
      updateSetting('customModes', updatedModes)
      
      setSelectedModeId(newMode.id)
      setIsEditing(true)
      setEditForm({
        name: newMode.name,
        description: newMode.description,
        systemPrompt: newMode.systemPrompt
      })
    } catch (error) {
      console.error('Failed to create mode:', error)
      alert('Failed to create mode. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditMode = (mode: CustomMode) => {
    setIsEditing(true)
    setSelectedModeId(mode.id)
    setEditForm({
      name: mode.name,
      description: mode.description,
      systemPrompt: mode.systemPrompt
    })
  }

  const handleSaveMode = async () => {
    if (!editForm.name.trim()) {
      return
    }

    try {
      setIsSaving(true)
      
      // Get current user from Keycloak auth
      const session = await keycloakAuth.getSession()
      
      if (!session?.user) {
        // Fallback to localStorage if not logged in
        if (isEditing && selectedModeId) {
          const updatedModes = customModes.map(mode =>
            mode.id === selectedModeId
              ? {
                  ...mode,
                  name: editForm.name.trim(),
                  description: editForm.description.trim(),
                  systemPrompt: editForm.systemPrompt.trim()
                }
              : mode
          )
          setCustomModes(updatedModes)
          updateSetting('customModes', updatedModes)
        }
        setIsEditing(false)
        setEditForm({ name: '', description: '', systemPrompt: '' })
        return
      }

      // Update via backend API (local database)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/custom-modes/${selectedModeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.user.id,
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          systemPrompt: editForm.systemPrompt.trim()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update mode: ${response.statusText}`)
      }

      // Update local state
      const updatedModes = customModes.map(mode =>
        mode.id === selectedModeId
          ? {
              ...mode,
              name: editForm.name.trim(),
              description: editForm.description.trim(),
              systemPrompt: editForm.systemPrompt.trim()
            }
          : mode
      )
      setCustomModes(updatedModes)
      updateSetting('customModes', updatedModes)

      setIsEditing(false)
      setEditForm({ name: '', description: '', systemPrompt: '' })
    } catch (error) {
      console.error('Failed to save mode:', error)
      alert('Failed to save mode. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({
      name: '',
      description: '',
      systemPrompt: ''
    })
  }

  const handleDeleteMode = async (modeId: string) => {

    try {
      setIsSaving(true)
      
      // Get current user from Keycloak auth
      const session = await keycloakAuth.getSession()
      
      if (!session?.user) {
        // Fallback to localStorage if not logged in
        const updatedModes = customModes.filter(m => m.id !== modeId)
        setCustomModes(updatedModes)
        updateSetting('customModes', updatedModes)
        
        if (selectedModeId === modeId) {
          setSelectedModeId(updatedModes[0]?.id || null)
        }
        return
      }

      // Delete via backend API (local database)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/custom-modes/${modeId}?userId=${session.user.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete mode: ${response.statusText}`)
      }

      // Update local state
      const updatedModes = customModes.filter(m => m.id !== modeId)
      setCustomModes(updatedModes)
      updateSetting('customModes', updatedModes)
      
      if (selectedModeId === modeId) {
        setSelectedModeId(updatedModes[0]?.id || null)
      }
    } catch (error) {
      console.error('Failed to delete mode:', error)
      alert('Failed to delete mode. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetAsDefault = async (modeId: string) => {
    try {
      setIsSaving(true)
      updateSetting('defaultModeId', modeId)
      setSettings(prev => ({ ...prev, defaultModeId: modeId }))
    } catch (error) {
      console.error('Failed to set default mode:', error)
      alert('Failed to set default mode. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnsetDefault = async () => {
    try {
      setIsSaving(true)
      updateSetting('defaultModeId', undefined)
      setSettings(prev => ({ ...prev, defaultModeId: undefined }))
    } catch (error) {
      console.error('Failed to unset default mode:', error)
      alert('Failed to unset default mode. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedMode = customModes.find(m => m.id === selectedModeId)

  // Filter modes based on search query
  const filteredModes = customModes.filter(mode => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      mode.name.toLowerCase().includes(query) ||
      mode.description.toLowerCase().includes(query) ||
      mode.systemPrompt.toLowerCase().includes(query)
    )
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-400">Loading custom modes...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Modes</h2>
        <p className="text-zinc-400">Create and manage custom system prompts for different AI behaviors</p>
      </div>

      <div className="flex gap-0 h-full modes-settings-container">
        {/* Left Column - Modes List */}
        <div 
          className="flex-shrink-0 border-r border-zinc-800 pr-4 flex flex-col"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Your Modes</h3>
            <Button
              onClick={handleCreateMode}
              size="sm"
              variant="ghost"
              disabled={isSaving}
              className="h-7 px-3 text-white bg-zinc-800 hover:bg-zinc-700"
            >
              <span className="mr-1">Add Mode</span>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Box */}
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search modes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white text-sm h-9 focus:border-white focus:ring-white"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {customModes.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                No custom modes yet
              </div>
            ) : filteredModes.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                No modes match your search
              </div>
            ) : (
              <div className="space-y-1">
                {filteredModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSelectedModeId(mode.id)
                      setIsEditing(false)
                    }}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg transition-colors
                      ${selectedModeId === mode.id
                        ? 'bg-[#27272A] text-white'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{mode.name}</span>
                      {settings.defaultModeId === mode.id && (
                        <span className="text-xs text-white px-1.5 py-0.5 ml-2 flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className="w-1 cursor-col-resize hover:bg-zinc-500 transition-colors flex-shrink-0"
          onMouseDown={handleMouseDown}
          style={{ 
            backgroundColor: isResizing ? '#71717a' : 'transparent',
          }}
        />

        {/* Right Column - Mode Details/Editor */}
        <div className="flex-1 overflow-hidden flex flex-col pl-4 pt-1">
          {isEditing ? (
            <div className="flex flex-col h-full">
              {/* Header with editable name and description */}
              <div className="flex-shrink-0 pb-4 relative">
                <div className="mb-2 inline-block">
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Mode Name"
                    disabled={isSaving}
                    style={{ 
                      minWidth: '15ch',
                      width: `${Math.min(editForm.name.length + 2, 60)}ch`,
                      maxWidth: '60ch'
                    }}
                    className="text-xl font-semibold bg-zinc-800 border-zinc-700 text-white px-3 py-2 text-left focus:border-white focus:ring-white"
                  />
                </div>
                <div className="relative pr-52">
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Brief description (optional)"
                    disabled={isSaving}
                    className="bg-zinc-900 border-zinc-700 text-zinc-400 text-sm px-3 py-2 w-full focus:border-white focus:ring-white"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-zinc-500 whitespace-nowrap pl-4">
                    Created {new Date(selectedMode?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className="absolute top-0 right-0 flex gap-2">
                  <Button
                    onClick={handleCancelEdit}
                    size="sm"
                    variant="ghost"
                    disabled={isSaving}
                    className="text-white hover:text-white hover:bg-zinc-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveMode}
                    size="sm"
                    disabled={!editForm.name.trim() || isSaving}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>

              {/* System Prompt - Full height */}
              <div className="flex-1 flex flex-col overflow-hidden p-1">
                <Textarea
                  id="mode-prompt"
                  value={editForm.systemPrompt}
                  onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                  placeholder="Enter the system prompt that defines this mode's behavior..."
                  disabled={isSaving}
                  className="flex-1 bg-zinc-900 border-zinc-700 text-white font-mono text-sm resize-none focus:border-white focus:ring-white"
                />
              </div>
            </div>
          ) : selectedMode ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex-shrink-0 pb-4 relative">
                <div className="text-xl font-semibold text-white mb-2 truncate">
                  {selectedMode.name}
                </div>
                <div className="flex items-end justify-between">
                  {selectedMode.description && (
                    <div className="text-sm text-zinc-400 truncate">
                      {selectedMode.description}
                    </div>
                  )}
                  <span className="text-xs text-zinc-500 whitespace-nowrap ml-auto">
                    Created {new Date(selectedMode.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="absolute top-0 right-0 flex gap-2">
                  <Button
                    onClick={() => settings.defaultModeId === selectedMode.id ? handleUnsetDefault() : handleSetAsDefault(selectedMode.id)}
                    size="sm"
                    variant="ghost"
                    disabled={isSaving}
                    className="text-white hover:text-white hover:bg-zinc-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {settings.defaultModeId === selectedMode.id ? 'Unset Default' : 'Set as Default'}
                  </Button>
                  <Button
                    onClick={() => handleEditMode(selectedMode)}
                    size="sm"
                    variant="ghost"
                    disabled={isSaving}
                    className="text-white hover:text-white hover:bg-zinc-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteMode(selectedMode.id)}
                    size="sm"
                    variant="ghost"
                    disabled={isSaving}
                    className="text-white hover:text-white hover:bg-zinc-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* System Prompt - Full height */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-y-auto">
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
                    {selectedMode.systemPrompt || 'No system prompt defined yet.'}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-400">
              <div className="text-center">
                <p className="text-lg mb-2">No mode selected</p>
                <p className="text-sm">Create a new mode or select one from the list</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
