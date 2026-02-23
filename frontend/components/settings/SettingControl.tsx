'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SettingBaseProps {
  label: string
  description?: string
}

interface SettingToggleProps extends SettingBaseProps {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export function SettingToggle({ label, description, value, onChange, disabled }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-zinc-800/50 last:border-b-0">
      <div className="flex-1 pr-8">
        <label className="text-sm font-medium text-white block">
          {label}
        </label>
        {description && (
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <Switch
          checked={value}
          onCheckedChange={onChange}
          disabled={disabled}
          className="data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-700"
        />
      </div>
    </div>
  )
}

interface SettingSliderProps extends SettingBaseProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

export function SettingSlider({ 
  label, 
  description, 
  value, 
  min, 
  max, 
  step, 
  onChange, 
  formatValue 
}: SettingSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString()

  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-white">
          {label}
        </label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-mono text-zinc-400 bg-zinc-700/10 px-2.5 py-1 rounded border border-zinc-500/20">
                {displayValue}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Current value: {displayValue}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {description && (
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{description}</p>
      )}
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-500 w-12 text-right">{formatValue ? formatValue(min) : min}</span>
        <Slider
          value={[value]}
          onValueChange={(values) => onChange(values[0])}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <span className="text-xs text-zinc-500 w-12">{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  )
}

interface SettingInputProps extends SettingBaseProps {
  type?: 'text' | 'password' | 'number'
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
}

export function SettingInput({ label, description, type = 'text', value, onChange, placeholder }: SettingInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0">
      <label className="text-sm font-medium text-white block mb-1.5">
        {label}
      </label>
      {description && (
        <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{description}</p>
      )}
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full px-3 py-2.5 bg-zinc-900 rounded-lg
            text-white text-sm placeholder-zinc-500
            border border-zinc-800
            focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent
            transition-all duration-200
          "
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  )
}

interface SettingSelectProps extends SettingBaseProps {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

export function SettingSelect({ label, description, value, options, onChange }: SettingSelectProps) {
  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0">
      <label className="text-sm font-medium text-white block mb-1.5">
        {label}
      </label>
      {description && (
        <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{description}</p>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full px-3 py-2.5 bg-zinc-900 rounded-lg
          text-white text-sm
          border border-zinc-800
          focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent
          transition-all duration-200
          cursor-pointer
        "
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface SettingSegmentedControlProps extends SettingBaseProps {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

export function SettingSegmentedControl({ label, description, value, options, onChange }: SettingSegmentedControlProps) {
  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0">
      <label className="text-sm font-medium text-white block mb-1.5">
        {label}
      </label>
      {description && (
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{description}</p>
      )}
      <div className="inline-flex rounded-lg bg-zinc-900 p-1 border border-zinc-800">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-5 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${value === option.value
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}


interface SettingRadioGroupProps extends SettingBaseProps {
  value: string
  options: Array<{
    value: string
    label: string
    icon?: React.ComponentType<{ className?: string }>
    description?: string
  }>
  onChange: (value: string) => void
  layout?: 'horizontal' | 'vertical' | 'grid'
}

export function SettingRadioGroup({ 
  label, 
  description, 
  value, 
  options, 
  onChange, 
  layout = 'grid' 
}: SettingRadioGroupProps) {
  const layoutClasses = {
    horizontal: 'flex gap-3',
    vertical: 'flex flex-col gap-3',
    grid: 'grid grid-cols-3 gap-3'
  }

  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0">
      <label className="text-sm font-medium text-white block mb-1.5">
        {label}
      </label>
      {description && (
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{description}</p>
      )}
      <div className={layoutClasses[layout]}>
        {options.map((option) => {
          const Icon = option.icon
          const isActive = value === option.value

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                flex flex-col items-center justify-center gap-3 p-5 rounded-lg 
                border transition-all duration-200
                ${isActive
                  ? 'bg-zinc-700/10 border-zinc-500/50 ring-2 ring-zinc-500/20'
                  : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                }
              `}
            >
              {Icon && <Icon className={`w-6 h-6 ${isActive ? 'text-zinc-400' : 'text-zinc-400'}`} />}
              <span className={`text-sm font-medium ${isActive ? 'text-zinc-400' : 'text-zinc-300'}`}>
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-zinc-500 text-center">{option.description}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
