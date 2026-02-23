'use client'

import { 
  Network, 
  Palette, 
  Settings2, 
  Keyboard, 
  Sliders,
  Monitor,
  Sparkles,
  User as UserIcon
} from 'lucide-react'

type SettingsCategory = 'models' | 'modes' | 'os' | 'appearance' | 'behavior' | 'keyboard' | 'advanced'

interface AuthUser {
  name: string
  email: string
  avatar?: string  // Changed from picture to avatar to match AppSidebar
}

interface SettingsNavProps {
  activeCategory: SettingsCategory
  onCategoryChange: (category: SettingsCategory) => void
  user?: AuthUser | null
}

interface NavItem {
  id: SettingsCategory
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { id: 'models', label: 'Models & API', icon: Network },
      { id: 'modes', label: 'Modes', icon: Sparkles },
      { id: 'os', label: 'Operating Systems', icon: Monitor },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'behavior', label: 'Behavior', icon: Settings2 }
    ]
  },
  {
    title: 'Advanced',
    items: [
      { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard },
      { id: 'advanced', label: 'Advanced', icon: Sliders }
    ]
  }
]

export function SettingsNav({ activeCategory, onCategoryChange, user }: SettingsNavProps) {
  // Get user display info - match the exact same logic as AppSidebar
  const userName = user?.name || 'User'
  const userEmail = user?.email || ''
  const userAvatar = user?.avatar  // Changed from picture to avatar

  return (
    <nav className="w-64 border-r border-zinc-800 bg-[#0a0a0a] flex flex-col settings-nav">
      {/* Navigation Items - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-3">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item, itemIndex) => {
                  const Icon = item.icon
                  const isActive = activeCategory === item.id

                  return (
                    <button
                      key={`${sectionIndex}-${itemIndex}`}
                      onClick={() => onCategoryChange(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg
                        transition-all duration-200
                        ${isActive
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Profile Section - Fixed at Bottom */}
      {user && (
        <div className="p-4">
          <div className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-800 rounded-lg transition-colors">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0a0a0a]" />
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {userName}
              </div>
              <div className="text-xs text-zinc-500 truncate">
                {userEmail}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
