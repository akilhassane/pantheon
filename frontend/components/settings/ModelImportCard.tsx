'use client'

import { ProviderModelInfo } from '@/utils/providerApis'

interface ModelImportCardProps {
  model: ProviderModelInfo
  isSelected: boolean
  onToggle: () => void
}

export function ModelImportCard({
  model,
  isSelected,
  onToggle
}: ModelImportCardProps) {
  return (
    <div
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${isSelected
          ? 'border-2 border-zinc-500 bg-zinc-500/10'
          : 'border border-zinc-800 bg-[#27272A] hover:border-zinc-700'
        }
      `}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all flex-shrink-0
            ${isSelected
              ? 'bg-zinc-500 border-2 border-zinc-500'
              : 'border-2 border-zinc-600 hover:border-zinc-500'
            }
          `}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {isSelected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm">{model.name}</h4>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{model.id}</p>
        </div>
      </div>
    </div>
  )
}
