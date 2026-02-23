'use client'

import * as React from 'react'
import { Folder, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { Workspace } from '@/types/session'
import { WorkspacesListProps } from '@/types/sidebar'

export function WorkspacesList({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceCreate,
  onWorkspaceDelete,
}: WorkspacesListProps) {
  return (
    <SidebarMenu>
      {workspaces.map((workspace) => (
        <Collapsible
          key={workspace.id}
          defaultOpen={workspace.id === activeWorkspaceId}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={workspace.id === activeWorkspaceId}
                onClick={() => onWorkspaceSelect(workspace.id)}
              >
                <Folder className="h-4 w-4" />
                <span>{workspace.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {workspace.sessionIds.length}
                </span>
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {workspace.sessionIds.map((sessionId) => (
                  <SidebarMenuSubItem key={sessionId}>
                    <SidebarMenuSubButton>
                      <span>Session {sessionId.substr(-8)}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      ))}
    </SidebarMenu>
  )
}
