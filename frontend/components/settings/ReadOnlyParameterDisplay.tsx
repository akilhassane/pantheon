'use client'

interface ReadOnlyParameterDisplayProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  formatValue?: (value: number) => string
}

export function ReadOnlyParameterDisplay({
  label,
  description,
  value,
  min,
  max,
  formatValue
}: ReadOnlyParameterDisplayProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString()
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="py-4 border-b border-zinc-800/50 opacity-75">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-white cursor-not-allowed">
          {label}
        </label>
        <span className="text-sm font-mono text-black bg-white px-2 py-1 rounded cursor-not-allowed">
          {displayValue}
        </span>
      </div>
      {description && (
        <p className="text-sm text-white mb-3">{description}</p>
      )}
      <div className="flex items-center gap-4 pointer-events-none">
        <span className="text-xs text-white w-12 text-right">
          {formatValue ? formatValue(min) : min}
        </span>
        <div className="flex-1 h-2 rounded-full relative" style={{ backgroundColor: '#27272A' }}>
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full"
            style={{
              width: `${percentage}%`
            }}
          />
        </div>
        <span className="text-xs text-white w-12">
          {formatValue ? formatValue(max) : max}
        </span>
      </div>
    </div>
  )
}
