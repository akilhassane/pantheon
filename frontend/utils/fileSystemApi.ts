/**
 * File System API utilities for project explorer
 * Note: This is a client-side implementation that would need backend support
 * for actual file system access in a production environment
 */

import { FileSystemNode } from '@/types/sidebar'

/**
 * Mock file system data for demonstration
 * In production, this would call a backend API
 */
const mockFileSystem: FileSystemNode = {
  name: 'project',
  path: '/',
  type: 'directory',
  isExpanded: false,
  children: [
    {
      name: 'frontend',
      path: '/frontend',
      type: 'directory',
      isExpanded: false,
      children: [
        {
          name: 'components',
          path: '/frontend/components',
          type: 'directory',
          isExpanded: false,
          children: [
            { name: 'Button.tsx', path: '/frontend/components/Button.tsx', type: 'file', size: 1024 },
            { name: 'Input.tsx', path: '/frontend/components/Input.tsx', type: 'file', size: 2048 }
          ]
        },
        {
          name: 'pages',
          path: '/frontend/pages',
          type: 'directory',
          isExpanded: false,
          children: [
            { name: 'index.tsx', path: '/frontend/pages/index.tsx', type: 'file', size: 4096 },
            { name: 'about.tsx', path: '/frontend/pages/about.tsx', type: 'file', size: 2048 }
          ]
        },
        { name: 'package.json', path: '/frontend/package.json', type: 'file', size: 512 }
      ]
    },
    {
      name: 'backend',
      path: '/backend',
      type: 'directory',
      isExpanded: false,
      children: [
        { name: 'server.js', path: '/backend/server.js', type: 'file', size: 8192 },
        { name: 'package.json', path: '/backend/package.json', type: 'file', size: 512 }
      ]
    },
    { name: 'README.md', path: '/README.md', type: 'file', size: 1024 },
    { name: '.gitignore', path: '/.gitignore', type: 'file', size: 256 }
  ]
}

/**
 * Get file system tree starting from root path
 * In production, this would make an API call to the backend
 */
export async function getFileSystemTree(rootPath: string = '/'): Promise<FileSystemNode> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // In production, this would be:
  // const response = await fetch(`/api/files?path=${encodeURIComponent(rootPath)}`)
  // return response.json()
  
  return mockFileSystem
}

/**
 * Get file contents
 * In production, this would make an API call to the backend
 */
export async function getFileContents(filePath: string): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // In production, this would be:
  // const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`)
  // return response.text()
  
  return `// Contents of ${filePath}\n// This is mock data\n\nexport default function Component() {\n  return <div>Hello World</div>\n}`
}

/**
 * Get file type icon based on file extension
 */
export function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  const iconMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': '📄',
    'jsx': '⚛️',
    'ts': '📘',
    'tsx': '⚛️',
    'json': '📋',
    
    // Styles
    'css': '🎨',
    'scss': '🎨',
    'sass': '🎨',
    'less': '🎨',
    
    // Markup
    'html': '🌐',
    'xml': '📰',
    'svg': '🖼️',
    
    // Documentation
    'md': '📝',
    'txt': '📄',
    'pdf': '📕',
    
    // Config
    'yml': '⚙️',
    'yaml': '⚙️',
    'toml': '⚙️',
    'ini': '⚙️',
    'env': '🔐',
    
    // Images
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🖼️',
    'webp': '🖼️',
    
    // Other
    'gitignore': '🚫',
    'lock': '🔒'
  }
  
  return iconMap[extension || ''] || '📄'
}

/**
 * Get directory icon
 */
export function getDirectoryIcon(isExpanded: boolean): string {
  return isExpanded ? '📂' : '📁'
}

/**
 * Search for files matching a query
 */
export function searchFiles(
  node: FileSystemNode,
  query: string,
  results: FileSystemNode[] = []
): FileSystemNode[] {
  const lowerQuery = query.toLowerCase()
  const lowerName = node.name.toLowerCase()
  
  if (lowerName.includes(lowerQuery)) {
    results.push(node)
  }
  
  if (node.type === 'directory' && node.children) {
    for (const child of node.children) {
      searchFiles(child, query, results)
    }
  }
  
  return results
}

/**
 * Find a node by path
 */
export function findNodeByPath(
  root: FileSystemNode,
  path: string
): FileSystemNode | null {
  if (root.path === path) {
    return root
  }
  
  if (root.type === 'directory' && root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, path)
      if (found) {
        return found
      }
    }
  }
  
  return null
}

/**
 * Toggle directory expansion
 */
export function toggleDirectory(
  root: FileSystemNode,
  path: string
): FileSystemNode {
  if (root.path === path && root.type === 'directory') {
    return { ...root, isExpanded: !root.isExpanded }
  }
  
  if (root.type === 'directory' && root.children) {
    return {
      ...root,
      children: root.children.map(child => toggleDirectory(child, path))
    }
  }
  
  return root
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // Less than 1 minute
  if (diff < 60000) return 'Just now'
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  }
  
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
  
  // Format as date
  return date.toLocaleDateString()
}
