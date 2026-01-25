'use client'

import * as React from 'react'
import { FileText, Folder, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { FileSystemNode, ProjectExplorerProps } from '@/types/sidebar'

export function FileExplorer({
  isOpen,
  onClose,
  rootPath,
  onFileSelect,
  onFilePreview,
}: ProjectExplorerProps) {
  const [fileTree, setFileTree] = React.useState<FileSystemNode[]>([
    {
      name: 'root',
      path: '/root',
      type: 'directory',
      children: [
        { name: 'Documents', path: '/root/Documents', type: 'directory' },
        { name: 'Downloads', path: '/root/Downloads', type: 'directory' },
        { name: '.bashrc', path: '/root/.bashrc', type: 'file' },
      ],
    },
  ])

  return (
    <SidebarMenu>
      {fileTree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onSelect={onFileSelect}
          onPreview={onFilePreview}
        />
      ))}
    </SidebarMenu>
  )
}

function FileTreeNode({
  node,
  onSelect,
  onPreview,
}: {
  node: FileSystemNode
  onSelect: (path: string) => void
  onPreview: (path: string) => void
}) {
  if (node.type === 'file') {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => onSelect(node.path)}>
          <FileText className="h-4 w-4" />
          <span>{node.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <Folder className="h-4 w-4" />
            <span>{node.name}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {node.children?.map((child) => (
              <SidebarMenuSubItem key={child.path}>
                <FileTreeNode node={child} onSelect={onSelect} onPreview={onPreview} />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
