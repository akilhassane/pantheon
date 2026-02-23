'use client'

import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ModelCardProps {
  model: {
    id: string
    name: string
    provider: string
    description: string
    capabilities?: string[]
  }
  enabled: boolean
  isDefault: boolean
  onToggle: (enabled: boolean) => void
  onSetDefault?: () => void
}

export function ModelCard({ 
  model, 
  enabled, 
  isDefault, 
  onToggle, 
  onSetDefault 
}: ModelCardProps) {
  const handleToggle = (checked: boolean) => {
    if (!checked && isDefault) {
      // Prevent disabling the default model
      return
    }
    onToggle(checked)
  }

  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-all duration-200
        ${enabled
          ? 'border-zinc-500/50 bg-zinc-700/5'
          : 'border-zinc-800 bg-zinc-900/50'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white truncate">
              {model.name}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {model.provider}
            </Badge>
            {isDefault && (
              <Badge className="text-xs bg-zinc-700">
                Default
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-zinc-400 mb-2">
            {model.description}
          </p>

          {model.capabilities && model.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {model.capabilities.map((capability) => (
                <Badge key={capability} variant="outline" className="text-xs">
                  {capability}
                </Badge>
              ))}
            </div>
          )}

          {enabled && !isDefault && onSetDefault && (
            <Button
              onClick={onSetDefault}
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs"
            >
              Set as Default
            </Button>
          )}

          {isDefault && !enabled && (
            <div className="flex items-center gap-2 mt-2 text-yellow-400 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Cannot disable default model</span>
            </div>
          )}
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isDefault && enabled}
          className="data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-700"
        />
      </div>
    </div>
  )
}
