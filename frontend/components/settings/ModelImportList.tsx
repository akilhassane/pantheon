'use client'

import { ProviderModelInfo } from '@/utils/providerApis'
import { ModelImportCard } from './ModelImportCard'

interface ModelImportListProps {
  models: ProviderModelInfo[]
  selectedIds: Set<string>
  onToggleSelection: (modelId: string) => void
  searchQuery: string
}

export function ModelImportList({
  models,
  selectedIds,
  onToggleSelection,
  searchQuery
}: ModelImportListProps) {
  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filteredModels.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        No models found
      </div>
    )
  }

  return (
    <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2">
      {filteredModels.map(model => (
        <ModelImportCard
          key={model.id}
          model={model}
          isSelected={selectedIds.has(model.id)}
          onToggle={() => onToggleSelection(model.id)}
        />
      ))}
    </div>
  )
}
