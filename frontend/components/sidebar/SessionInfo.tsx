'use client'

import * as React from 'react'
import { Terminal, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SessionInfoProps } from '@/types/sidebar'

export function SessionInfo({ session, terminalInfo }: SessionInfoProps) {
  if (!session || !terminalInfo) {
    return null
  }

  return (
    <Card className="m-2">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-medium truncate">{session.name}</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>PID: {terminalInfo.pid}</div>
          <div className="truncate">Dir: {terminalInfo.workingDirectory}</div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{terminalInfo.activeUsers || 0} users</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className={`h-2 w-2 rounded-full ${
                terminalInfo.connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`}
            />
            <span>{terminalInfo.connectionStatus}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
