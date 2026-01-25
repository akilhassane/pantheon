'use client'

import * as React from 'react'
import { Plus, SplitSquareHorizontal, SplitSquareVertical, Info } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { TerminalActionsProps } from '@/types/sidebar'

export function TerminalActions({
  currentSessionId,
  onNewWindow,
  onSplitHorizontal,
  onSplitVertical,
  onShowInfo,
}: TerminalActionsProps) {
  if (!currentSessionId) {
    return (
      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
        No active session
      </div>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={onNewWindow}>
          <Plus className="h-4 w-4" />
          <span>New Window</span>
          <kbd className="ml-auto text-xs">Ctrl+Shift+N</kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={onSplitHorizontal}>
          <SplitSquareHorizontal className="h-4 w-4" />
          <span>Split Horizontal</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={onSplitVertical}>
          <SplitSquareVertical className="h-4 w-4" />
          <span>Split Vertical</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={onShowInfo}>
          <Info className="h-4 w-4" />
          <span>Terminal Info</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
