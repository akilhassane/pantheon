'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ModelConfig } from '@/types/settings'

interface ModelDiagnosticsProps {
  model: ModelConfig
}

export function ModelDiagnostics({ model }: ModelDiagnosticsProps) {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const runDiagnostics = async () => {
    setTesting(true)
    const results: any = {
      modelId: model.id,
      modelName: model.name,
      hasApiKey: !!model.apiKey,
      apiKeyFormat: model.apiKey ? model.apiKey.substring(0, 10) + '...' : 'None',
      provider: model.provider || 'Not set',
      contextLength: model.contextLength || 'Not set',
      maxOutputTokens: model.maxOutputTokens || 'Not set',
      hasParameters: !!model.parameters,
      parameterCount: model.parameters ? Object.keys(model.parameters).length : 0,
      hasPricing: !!model.pricing,
      hasDescription: !!model.description
    }

    if (model.apiKey) {
      try {
        const { detectProvider, fetchModelInfoFromProvider } = await import('@/utils/providerApis')
        const detectedProvider = detectProvider(model.apiKey)
        results.detectedProvider = detectedProvider
        
        const info = await fetchModelInfoFromProvider(model.apiKey, model.id)
        results.apiCallSuccess = !!info
        results.fetchedInfo = info
      } catch (error: any) {
        results.apiCallSuccess = false
        results.error = error.message
      }
    }

    setDiagnostics(results)
    setTesting(false)
  }

  return (
    <div className="mt-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <h5 className="text-sm font-medium text-white mb-3">Diagnostics</h5>
      
      <Button
        onClick={runDiagnostics}
        disabled={testing}
        size="sm"
        variant="outline"
        className="w-full mb-3"
      >
        {testing ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </Button>

      {diagnostics && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-zinc-400">Has API Key:</span>
            <span className={diagnostics.hasApiKey ? 'text-green-400' : 'text-red-400'}>
              {diagnostics.hasApiKey ? 'Yes' : 'No'}
            </span>

            {diagnostics.hasApiKey && (
              <>
                <span className="text-zinc-400">Detected Provider:</span>
                <span className="text-white">{diagnostics.detectedProvider}</span>

                <span className="text-zinc-400">API Call Success:</span>
                <span className={diagnostics.apiCallSuccess ? 'text-green-400' : 'text-red-400'}>
                  {diagnostics.apiCallSuccess ? 'Yes' : 'No'}
                </span>
              </>
            )}

            <span className="text-zinc-400">Has Parameters:</span>
            <span className={diagnostics.hasParameters ? 'text-green-400' : 'text-yellow-400'}>
              {diagnostics.hasParameters ? `Yes (${diagnostics.parameterCount})` : 'No'}
            </span>

            <span className="text-zinc-400">Context Length:</span>
            <span className="text-white">{diagnostics.contextLength}</span>

            <span className="text-zinc-400">Max Output:</span>
            <span className="text-white">{diagnostics.maxOutputTokens}</span>
          </div>

          {diagnostics.error && (
            <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded">
              <p className="text-red-400 text-xs">{diagnostics.error}</p>
            </div>
          )}

          {diagnostics.fetchedInfo && (
            <details className="mt-2">
              <summary className="text-zinc-400 cursor-pointer hover:text-white">
                View Fetched Data
              </summary>
              <pre className="mt-2 p-2 bg-zinc-950 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(diagnostics.fetchedInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
