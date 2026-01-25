'use client'

import { ReadOnlyParameterDisplay } from './ReadOnlyParameterDisplay'

interface ModelParametersSectionProps {
  modelParameters?: {
    temperature?: { min: number; max: number; default: number }
    maxTokens?: { min: number; max: number; default: number }
    topP?: { min: number; max: number; default: number }
    frequencyPenalty?: { min: number; max: number; default: number }
    presencePenalty?: { min: number; max: number; default: number }
  }
}

export function ModelParametersSection({
  modelParameters
}: ModelParametersSectionProps) {
  const tempParams = modelParameters?.temperature || { min: 0.0, max: 2.0, default: 0.7 }
  const tokensParams = modelParameters?.maxTokens || { min: 100, max: 8000, default: 2000 }
  const topPParams = modelParameters?.topP || { min: 0.0, max: 1.0, default: 1.0 }
  const freqParams = modelParameters?.frequencyPenalty || { min: -2.0, max: 2.0, default: 0.0 }
  const presParams = modelParameters?.presencePenalty || { min: -2.0, max: 2.0, default: 0.0 }

  return (
    <div className="space-y-4">
      <ReadOnlyParameterDisplay
        label="Temperature"
        description={`Controls randomness (${tempParams.min}-${tempParams.max})`}
        value={tempParams.default}
        min={tempParams.min}
        max={tempParams.max}
        formatValue={(value) => value.toFixed(1)}
      />

      <ReadOnlyParameterDisplay
        label="Max Tokens"
        description={`Maximum response length (${tokensParams.min}-${tokensParams.max.toLocaleString()})`}
        value={tokensParams.default}
        min={tokensParams.min}
        max={tokensParams.max}
        formatValue={(value) => `${value.toLocaleString()} tokens`}
      />

      <ReadOnlyParameterDisplay
        label="Top P"
        description={`Nucleus sampling (${topPParams.min}-${topPParams.max})`}
        value={topPParams.default}
        min={topPParams.min}
        max={topPParams.max}
        formatValue={(value) => value.toFixed(1)}
      />

      <ReadOnlyParameterDisplay
        label="Frequency Penalty"
        description={`Reduces repetition (${freqParams.min}-${freqParams.max})`}
        value={freqParams.default}
        min={freqParams.min}
        max={freqParams.max}
        formatValue={(value) => value.toFixed(1)}
      />

      <ReadOnlyParameterDisplay
        label="Presence Penalty"
        description={`Encourages new topics (${presParams.min}-${presParams.max})`}
        value={presParams.default}
        min={presParams.min}
        max={presParams.max}
        formatValue={(value) => value.toFixed(1)}
      />
    </div>
  )
}
