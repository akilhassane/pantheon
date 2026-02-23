'use client'

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface APIKeyInputProps {
  provider: 'gemini' | 'openai' | 'anthropic' | 'cohere' | 'mistral'
  value: string
  onChange: (value: string) => void
  onTest: () => Promise<void>
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  errorMessage?: string
}

const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    placeholder: 'Enter your Gemini API key...',
    icon: '🔷'
  },
  openai: {
    name: 'OpenAI',
    placeholder: 'Enter your OpenAI API key...',
    icon: '🤖'
  },
  anthropic: {
    name: 'Anthropic Claude',
    placeholder: 'Enter your Anthropic API key...',
    icon: '🧠'
  },
  cohere: {
    name: 'Cohere',
    placeholder: 'Enter your Cohere API key...',
    icon: '🔮'
  },
  mistral: {
    name: 'Mistral AI',
    placeholder: 'Enter your Mistral API key...',
    icon: '🌪️'
  }
}

export function APIKeyInput({
  provider,
  value,
  onChange,
  onTest,
  testStatus,
  errorMessage
}: APIKeyInputProps) {
  const [showKey, setShowKey] = useState(false)
  const info = PROVIDER_INFO[provider]

  return (
    <div className="py-4 border-b border-zinc-800/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{info.icon}</span>
        <label className="text-sm font-medium text-white">
          {info.name}
        </label>
      </div>
      
      <div className="space-y-3">
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={info.placeholder}
            className="
              w-full px-3 py-2 pr-10 bg-zinc-900 rounded-lg
              text-white placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-zinc-500
              transition-all duration-200
              font-mono text-sm
            "
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={onTest}
            disabled={!value || testStatus === 'testing'}
            size="sm"
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {testStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test Connection
          </Button>

          {testStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Connection successful</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4" />
              <span>{errorMessage || 'Connection failed'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
