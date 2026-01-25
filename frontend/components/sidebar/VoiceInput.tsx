'use client'

import React, { useState } from 'react'
import { VoiceInputProps } from '@/types/sidebar'
import { useVoiceRecording } from '@/hooks/useVoiceRecording'
import { Mic, Square, X, AlertCircle } from 'lucide-react'

export default function VoiceInput({
  isActive,
  onTranscriptionComplete,
  onError,
  onCancel
}: VoiceInputProps) {
  const { state, startRecording, stopRecording } = useVoiceRecording()
  const [isTranscribing, setIsTranscribing] = useState(false)

  const handleStart = async () => {
    try {
      await startRecording()
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to start recording'))
    }
  }

  const handleStop = async () => {
    try {
      const audioBlob = await stopRecording()
      setIsTranscribing(true)

      // Use Web Speech API for transcription with multilingual support
      const recognition = new (window as any).webkitSpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      
      // Common languages to try - covers most use cases
      // The API will use the first one, but we set maxAlternatives high
      // to get better recognition across languages
      const commonLanguages = [
        navigator.language, // User's browser language first
        'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 
        'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA', 'ru-RU', 'hi-IN'
      ]
      
      recognition.lang = commonLanguages[0]
      recognition.maxAlternatives = 10

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        onTranscriptionComplete(transcript)
        setIsTranscribing(false)
      }

      recognition.onerror = (event: any) => {
        setIsTranscribing(false)
        onError(new Error(`Transcription failed: ${event.error}`))
      }

      recognition.start()
    } catch (error) {
      setIsTranscribing(false)
      onError(error instanceof Error ? error : new Error('Failed to stop recording'))
    }
  }

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      
      <div className="relative rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}>
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="text-xl font-semibold text-white mb-6">Voice Input</h2>

          {state.error && (
            <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{state.error}</p>
            </div>
          )}

          <div className="relative mb-6">
            <button
              onClick={state.isRecording ? handleStop : handleStart}
              disabled={isTranscribing}
              className={`
                w-32 h-32 rounded-full flex items-center justify-center transition-all
                ${state.isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-blue-500 hover:bg-blue-600'
                }
                ${isTranscribing && 'opacity-50 cursor-not-allowed'}
              `}
            >
              {state.isRecording ? (
                <Square className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
            </button>

            {state.isRecording && (
              <div 
                className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping"
                style={{ animationDuration: '2s' }}
              />
            )}
          </div>

          {state.isRecording && (
            <div className="w-full mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400">Recording...</span>
              </div>
              <div className="text-2xl font-mono text-white text-center">
                {Math.floor(state.duration / 60)}:{(state.duration % 60).toString().padStart(2, '0')}
              </div>
              
              <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{ width: `${state.audioLevel * 100}%` }}
                />
              </div>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Transcribing...</span>
            </div>
          )}

          <p className="text-sm text-gray-400 text-center mt-4">
            {state.isRecording 
              ? 'Click the button to stop recording' 
              : 'Click the microphone to start recording'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
