'use client'

import React, { useState, useEffect } from 'react'
import { ProjectExplorerProps, FileSystemNode } from '@/types/sidebar'
import { X, Search, ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import { getFileIcon, searchFiles, toggleDirectory } from '@/utils/fileSystemApi'

export default function ProjectExplorer({
  isOpen,
  onClose,
  rootPath,
  onFileSelect,
  onFilePreview
}: ProjectExplorerProps) {
  const [fileTree, setFileTree] = useState<FileSystemNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]))
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadFileTree()
    }
  }, [isOpen, rootPath])

  const loadFileTree = async () => {
    const mockTree: FileSystemNode = {
      name: 'project',
      path: '/',
      type: 'directory',
      isExpanded: true,
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
                { name: 'Button.tsx', path: '/frontend/components/Button.tsx', type: 'file' },
                { name: 'Input.tsx', path: '/frontend/components/Input.tsx', type: 'file' }
              ]
            },
            { name: 'app', path: '/frontend/app', type: 'directory', isExpanded: false, children: [] },
            { name: 'package.json', path: '/frontend/package.json', type: 'file' }
          ]
        },
        {
          name: 'backend',
          path: '/backend',
          type: 'directory',
          isExpanded: false,
          children: [
            { name: 'server.js', path: '/backend/server.js', type: 'file' },
            { name: 'package.json', path: '/backend/package.json', type: 'file' }
          ]
        },
        { name: 'README.md', path: '/README.md', type: 'file' }
      ]
    }
    setFileTree(mockTree)
  }

  const handleToggle = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const handleFileClick = (node: FileSystemNode) => {
    if (node.type === 'file') {
      setSelectedPath(node.path)
      onFileSelect(node.path)
    } else {
      handleToggle(node.path)
    }
  }

  const renderNode = (node: FileSystemNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedPath === node.path
    const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch && node.type === 'file') return null

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded
            ${isSelected ? 'bg-slate-800 text-white' : 'text-gray-300'}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'directory' && (
            <span className="shrink-0">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
          <span className="shrink-0">
            {node.type === 'directory' ? (
              isExpanded ? <FolderOpen className="w-4 h-4 text-blue-400" /> : <Folder className="w-4 h-4 text-blue-400" />
            ) : (
              <File className="w-4 h-4 text-gray-400" />
            )}
          </span>
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-slate-700 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Project Files</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-3 py-2 bg-slate-800 text-white placeholder-gray-400 rounded-lg text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {fileTree && renderNode(fileTree)}
        </div>
      </div>
    </>
  )
}
