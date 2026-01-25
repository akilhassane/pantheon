'use client'

import { ModelCard } from './ModelCard'

interface Model {
  id: string
  name: string
  provider: string
  description: string
  capabilities?: string[]
}

interface ModelSelectionSectionProps {
  models: Model[]
  enabledModels: string[]
  defaultModel: string
  onToggleModel: (modelId: string, enabled: boolean) => void
  onSetDefault: (modelId: string) => void
}

const AVAILABLE_MODELS: Model[] = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Most capable model with advanced reasoning',
    capabilities: ['Vision', 'Code', 'Long Context']
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Fast and efficient for most tasks',
    capabilities: ['Vision', 'Code', 'Fast']
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    description: 'Lightweight and cost-effective',
    capabilities: ['Fast', 'Efficient']
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Experimental',
    provider: 'Google',
    description: 'Experimental features and improvements',
    capabilities: ['Experimental', 'Fast']
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Most capable GPT-4 model',
    capabilities: ['Vision', 'Code', 'Long Context']
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Advanced reasoning and analysis',
    capabilities: ['Code', 'Analysis']
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and cost-effective',
    capabilities: ['Fast', 'Efficient']
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Most capable Claude model',
    capabilities: ['Vision', 'Code', 'Long Context']
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance and speed',
    capabilities: ['Vision', 'Code']
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Fast and efficient',
    capabilities: ['Fast', 'Efficient']
  },
  {
    id: 'command-r-plus',
    name: 'Command R+',
    provider: 'Cohere',
    description: 'Advanced retrieval and generation',
    capabilities: ['RAG', 'Code']
  },
  {
    id: 'command-r',
    name: 'Command R',
    provider: 'Cohere',
    description: 'Efficient retrieval and generation',
    capabilities: ['RAG', 'Fast']
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
    description: 'Most capable Mistral model',
    capabilities: ['Code', 'Multilingual']
  },
  {
    id: 'mistral-medium',
    name: 'Mistral Medium',
    provider: 'Mistral',
    description: 'Balanced performance',
    capabilities: ['Code', 'Fast']
  }
]

export function ModelSelectionSection({
  enabledModels,
  defaultModel,
  onToggleModel,
  onSetDefault
}: ModelSelectionSectionProps) {
  return (
    <div className="space-y-3">
      {AVAILABLE_MODELS.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          enabled={enabledModels.includes(model.id)}
          isDefault={model.id === defaultModel}
          onToggle={(enabled) => onToggleModel(model.id, enabled)}
          onSetDefault={() => onSetDefault(model.id)}
        />
      ))}
    </div>
  )
}
