'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SettingsPanelProps } from '@/types/sidebar'

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <select
                className="w-full p-2 border rounded"
                value={settings.theme}
                onChange={(e) =>
                  onSettingsChange({ theme: e.target.value as any })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Font Size</Label>
              <select
                className="w-full p-2 border rounded"
                value={settings.fontSize}
                onChange={(e) =>
                  onSettingsChange({ fontSize: e.target.value as any })
                }
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Input
                value={settings.defaultModel}
                onChange={(e) =>
                  onSettingsChange({ defaultModel: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={settings.temperature}
                onChange={(e) =>
                  onSettingsChange({ temperature: parseFloat(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={settings.maxTokens}
                onChange={(e) =>
                  onSettingsChange({ maxTokens: parseInt(e.target.value) })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="terminal" className="space-y-4">
            <div className="space-y-2">
              <Label>Auto Save</Label>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) =>
                  onSettingsChange({ autoSave: e.target.checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Debug Mode</Label>
              <input
                type="checkbox"
                checked={settings.debugMode}
                onChange={(e) =>
                  onSettingsChange({ debugMode: e.target.checked })
                }
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
