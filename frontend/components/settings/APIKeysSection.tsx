'use client'

import { useState } from 'react'
import { APIKeyInput } from './APIKeyInput'
import { testAPIConnection, APITestResult } from '@/utils/apiTester'

interface APIKeysSectionProps {
  apiKeys: {
    gemini?: string
    openai?: string
    anthropic?: string
    cohere?: string
    mistral?: string
  }
  onUpdate: (provider: string, value: string) => void
}

type Provider = 'gemini' | 'openai' | 'anthropic' | 'cohere' | 'mistral'

export function APIKeysSection({ apiKeys, onUpdate }: APIKeysSectionProps) {
  const [testStatuses, setTestStatuses] = useState<Record<Provider, 'idle' | 'testing' | 'success' | 'error'>>({
    gemini: 'idle',
    openai: 'idle',
    anthropic: 'idle',
    cohere: 'idle',
    mistral: 'idle'
  })

  const [errorMessages, setErrorMessages] = useState<Record<Provider, string>>({
    gemini: '',
    openai: '',
    anthropic: '',
    cohere: '',
    mistral: ''
  })

  const handleTest = async (provider: Provider) => {
    const apiKey = apiKeys[provider]
    if (!apiKey) return

    setTestStatuses(prev => ({ ...prev, [provider]: 'testing' }))
    setErrorMessages(prev => ({ ...prev, [provider]: '' }))

    try {
      const result: APITestResult = await testAPIConnection(provider, apiKey)

      if (result.success) {
        setTestStatuses(prev => ({ ...prev, [provider]: 'success' }))
        // Auto-clear success message after 5 seconds
        setTimeout(() => {
          setTestStatuses(prev => ({ ...prev, [provider]: 'idle' }))
        }, 5000)
      } else {
        setTestStatuses(prev => ({ ...prev, [provider]: 'error' }))
        setErrorMessages(prev => ({ ...prev, [provider]: result.message || 'Connection failed' }))
      }
    } catch (error) {
      setTestStatuses(prev => ({ ...prev, [provider]: 'error' }))
      setErrorMessages(prev => ({ ...prev, [provider]: 'An unexpected error occurred' }))
    }
  }

  const providers: Provider[] = ['gemini', 'openai', 'anthropic', 'cohere', 'mistral']

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <APIKeyInput
          key={provider}
          provider={provider}
          value={apiKeys[provider] || ''}
          onChange={(value) => onUpdate(provider, value)}
          onTest={() => handleTest(provider)}
          testStatus={testStatuses[provider]}
          errorMessage={errorMessages[provider]}
        />
      ))}
    </div>
  )
}
