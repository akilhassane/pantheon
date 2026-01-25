'use client'

import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'

interface OSImage {
  id: string
  name: string
  version: string
  size: string
  status: 'available' | 'coming-soon'
  isDefault?: boolean
  provider: string
  releaseDate: string
  description: string
  imageUrl?: string
}

export function OperatingSystemsSettings() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedSize, setSelectedSize] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  
  const allOSImages: OSImage[] = [
    // Windows - Available
    { id: 'windows-11', name: 'Windows', version: '11 Pro', size: '5.2 GB', status: 'available', provider: 'Microsoft', releaseDate: '2021-10', description: 'Latest Windows OS', imageUrl: '/Images/OS/windows-11.jpg' },
    
    // Windows - Coming Soon
    { id: 'windows-10', name: 'Windows', version: '10 Pro', size: '4.8 GB', status: 'coming-soon', provider: 'Microsoft', releaseDate: '2015-07', description: 'Previous Windows version', imageUrl: '/Images/OS/windows-10.png' },
    { id: 'windows-server-2022', name: 'Windows Server', version: '2022', size: '6.1 GB', status: 'coming-soon', provider: 'Microsoft', releaseDate: '2021-08', description: 'Server operating system', imageUrl: '/Images/OS/windows-server-2022.png' },
    
    // Linux Distributions - Coming Soon
    { id: 'kali-linux', name: 'Kali Linux', version: '2024.1', size: '3.2 GB', status: 'coming-soon', provider: 'Offensive Security', releaseDate: '2024-02', description: 'Penetration testing distribution', imageUrl: '/Images/OS/kali-linux.jpg' },
    { id: 'ubuntu-22', name: 'Ubuntu', version: '22.04 LTS', size: '2.8 GB', status: 'coming-soon', provider: 'Canonical', releaseDate: '2022-04', description: 'Jammy Jellyfish', imageUrl: '/Images/OS/ubuntu-22.jpg' },
    { id: 'ubuntu-24', name: 'Ubuntu', version: '24.04 LTS', size: '3.0 GB', status: 'coming-soon', provider: 'Canonical', releaseDate: '2024-04', description: 'Latest LTS release', imageUrl: '/Images/OS/ubuntu-24.webp' },
    { id: 'debian-12', name: 'Debian', version: '12 (Bookworm)', size: '2.5 GB', status: 'coming-soon', provider: 'Debian Project', releaseDate: '2023-06', description: 'Stable Linux distribution', imageUrl: '/Images/OS/debian.jpg' },
    { id: 'debian-11', name: 'Debian', version: '11 (Bullseye)', size: '2.4 GB', status: 'coming-soon', provider: 'Debian Project', releaseDate: '2021-08', description: 'Previous stable release', imageUrl: '/Images/OS/debian.jpg' },
    { id: 'arch-linux', name: 'Arch Linux', version: 'Latest', size: '2.1 GB', status: 'coming-soon', provider: 'Arch Linux', releaseDate: '2024-01', description: 'Rolling release distribution', imageUrl: '/Images/OS/arch-linux.png' },
    { id: 'fedora-39', name: 'Fedora', version: '39', size: '2.9 GB', status: 'coming-soon', provider: 'Red Hat', releaseDate: '2023-11', description: 'Cutting-edge Linux distribution', imageUrl: '/Images/OS/fedora.jpg' },
    { id: 'parrot-os', name: 'Parrot OS', version: '5.3', size: '3.5 GB', status: 'coming-soon', provider: 'Parrot Security', releaseDate: '2023-09', description: 'Security-focused distribution', imageUrl: '/Images/OS/parrot-os.jpg' },
    
    // macOS - Coming Soon
    { id: 'macos-tahoe', name: 'macOS', version: 'Tahoe (26)', size: '13.0 GB', status: 'coming-soon', provider: 'Apple', releaseDate: '2025-09', description: 'Latest macOS version', imageUrl: '/Images/OS/macos-tahoe.jpg' },
    { id: 'macos-sequoia', name: 'macOS', version: 'Sequoia (15)', size: '12.9 GB', status: 'coming-soon', provider: 'Apple', releaseDate: '2024-09', description: 'Previous macOS version', imageUrl: '/Images/OS/macos-sequoia.png' },
    { id: 'macos-sonoma', name: 'macOS', version: 'Sonoma (14)', size: '12.8 GB', status: 'coming-soon', provider: 'Apple', releaseDate: '2023-09', description: 'Older macOS version', imageUrl: '/Images/OS/macos-sonoma.jpg' },
    { id: 'macos-ventura', name: 'macOS', version: 'Ventura (13)', size: '12.3 GB', status: 'coming-soon', provider: 'Apple', releaseDate: '2022-10', description: 'Older macOS version', imageUrl: '/Images/OS/macos-ventura.jpg' },
    { id: 'macos-monterey', name: 'macOS', version: 'Monterey (12)', size: '12.1 GB', status: 'coming-soon', provider: 'Apple', releaseDate: '2021-10', description: 'Older macOS version', imageUrl: '/Images/OS/macos-monterey.jpg' }
  ]
  
  const [osImages, setOsImages] = useState<OSImage[]>(() => {
    // Load default OS from localStorage
    if (typeof window !== 'undefined') {
      const savedDefaultOS = localStorage.getItem('default-os')
      const defaultOSId = savedDefaultOS || 'windows-11'
      
      return allOSImages.map(os => ({
        ...os,
        isDefault: os.id === defaultOSId
      }))
    }
    
    // Fallback for SSR
    return allOSImages.map(os => ({
      ...os,
      isDefault: os.id === 'windows-11'
    }))
  })
  
  // Get unique providers and sizes for filters
  const providers = ['all', ...Array.from(new Set(osImages.map(os => os.provider)))]
  const sizes = ['all', 'small (<3GB)', 'medium (3-6GB)', 'large (>6GB)']
  
  // Filter OS images
  const filteredOSImages = osImages.filter(os => {
    const matchesSearch = os.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         os.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         os.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesProvider = selectedProvider === 'all' || os.provider === selectedProvider
    
    let matchesSize = true
    if (selectedSize !== 'all') {
      const sizeInGB = parseFloat(os.size)
      if (selectedSize === 'small (<3GB)') matchesSize = sizeInGB < 3
      else if (selectedSize === 'medium (3-6GB)') matchesSize = sizeInGB >= 3 && sizeInGB <= 6
      else if (selectedSize === 'large (>6GB)') matchesSize = sizeInGB > 6
    }
    
    return matchesSearch && matchesProvider && matchesSize
  })

  const handleInstall = (id: string) => {
    // TODO: Implement OS installation logic
  }

  const handleUninstall = (id: string) => {
    // TODO: Implement OS uninstallation logic
  }

  const handleSetDefault = (id: string) => {
    setOsImages(prev => prev.map(os => ({
      ...os,
      isDefault: os.id === id
    })))
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('default-os', id)
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('default-os-changed', { detail: { osId: id } }))
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Operating Systems</h2>
        <p className="text-zinc-400">Manage available operating system images for your projects</p>
      </div>

      {/* Search Bar and Add Button */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search operating systems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Custom OS
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 transition-colors text-sm"
        >
          <Filter className="w-4 h-4" />
          Filters
          {(selectedProvider !== 'all' || selectedSize !== 'all') && (
            <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 rounded text-xs">
              Active
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-3 p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {providers.map(provider => (
                  <option key={provider} value={provider}>
                    {provider === 'all' ? 'All Providers' : provider}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Size</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {sizes.map(size => (
                  <option key={size} value={size}>
                    {size === 'all' ? 'All Sizes' : size}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setSelectedProvider('all')
                setSelectedSize('all')
              }}
              className="text-sm text-zinc-400 hover:text-blue-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-3 text-sm text-zinc-400">
        Showing {filteredOSImages.length} of {osImages.length} operating systems
      </div>

      {/* OS Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {filteredOSImages.map((os) => (
          <div
            key={os.id}
            className="relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors flex flex-col aspect-square group"
          >
            {/* Background Image */}
            {os.imageUrl && (
              <div 
                className={`absolute inset-0 bg-cover bg-center transition-opacity ${
                  os.status === 'available' 
                    ? 'opacity-70 group-hover:opacity-80' 
                    : 'opacity-30 group-hover:opacity-40'
                }`}
                style={{ 
                  backgroundImage: `url('${os.imageUrl}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            )}
            
            {/* Gradient Overlay for better text readability */}
            <div className={`absolute inset-0 bg-gradient-to-b ${
              os.status === 'available'
                ? 'from-black/30 via-black/40 to-black/60'
                : 'from-black/60 via-black/70 to-black/90'
            }`} />

            {/* Content */}
            <div className="relative z-10 p-4 flex flex-col h-full">
              {/* Header with Default Badge */}
              <div className="flex items-start justify-end mb-3">
                {os.isDefault && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white rounded border border-white/20 backdrop-blur-sm">
                    DEFAULT
                  </span>
                )}
              </div>

              {/* OS Info */}
              <div className="flex-1 mb-3">
                <h3 className="text-white font-medium text-lg mb-1">{os.name}</h3>
                <p className="text-sm text-zinc-300 mb-2">Version {os.version}</p>
                <div className="space-y-1 text-xs text-zinc-400">
                  <p>{os.provider}</p>
                  <p>{os.size} • {os.releaseDate}</p>
                </div>
                <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{os.description}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-auto">
                {!os.isDefault && os.status === 'available' && (
                  <button
                    onClick={() => handleSetDefault(os.id)}
                    className="w-full px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm border border-white/10"
                    title="Set as default OS"
                  >
                    Set Default
                  </button>
                )}
                {os.status === 'available' ? (
                  <span className="w-full text-center text-xs text-zinc-900 bg-white px-2 py-1.5 rounded font-medium">
                    Available
                  </span>
                ) : (
                  <span className="w-full text-center text-xs text-zinc-400 bg-white/10 backdrop-blur-sm px-2 py-1.5 rounded font-medium border border-white/10">
                    Coming soon
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
        <h4 className="text-sm font-medium text-white mb-2">About OS Images</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Operating system images are used to create isolated environments for your projects. 
          Each project can run in its own containerized OS instance with dedicated resources.
        </p>
      </div>
    </div>
  )
}
