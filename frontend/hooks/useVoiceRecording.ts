'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceRecordingState } from '@/types/sidebar'

export function useVoiceRecording() {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    error: null
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length
    const normalized = Math.min(average / 128, 1)
    
    setState(prev => ({ ...prev, audioLevel: normalized }))
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording. Please use Chrome, Firefox, or Edge.')
      }

      console.log('[VoiceRecording] Requesting microphone access...')
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      console.log('[VoiceRecording] Microphone access granted')
      console.log('[VoiceRecording] Audio tracks:', stream.getAudioTracks().length)
      
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      console.log('[VoiceRecording] MediaRecorder created, state:', mediaRecorder.state)

      mediaRecorder.ondataavailable = (event) => {
        console.log('[VoiceRecording] Data available, size:', event.data.size)
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('[VoiceRecording] MediaRecorder error:', event)
      }

      // Setup audio analysis
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      console.log('[VoiceRecording] Starting recording...')
      mediaRecorder.start(100) // Collect data every 100ms
      startTimeRef.current = Date.now()
      
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000)
        }))
      }, 1000)

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null
      }))

      console.log('[VoiceRecording] Recording started successfully')
      updateAudioLevel()
    } catch (error) {
      console.error('[VoiceRecording] Error starting recording:', error)
      
      let errorMessage = 'Failed to access microphone'
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.'
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.'
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Microphone is already in use by another application.'
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Microphone does not meet the required constraints.'
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Recording requires HTTPS. Please use a secure connection.'
        } else {
          errorMessage = error.message
        }
      }
      
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
    }
  }, [updateAudioLevel])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        console.error('[VoiceRecording] No recording in progress')
        reject(new Error('No recording in progress'))
        return
      }

      console.log('[VoiceRecording] Stopping recording...')
      console.log('[VoiceRecording] Chunks collected:', audioChunksRef.current.length)

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('[VoiceRecording] Recording stopped, blob size:', audioBlob.size, 'bytes')
        
        if (audioBlob.size === 0) {
          console.warn('[VoiceRecording] Warning: Audio blob is empty!')
        }
        
        resolve(audioBlob)
      }

      mediaRecorderRef.current.stop()
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('[VoiceRecording] Stopping track:', track.label)
          track.stop()
        })
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }

      setState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
        error: null
      })
    })
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.pause()
      setState(prev => ({ ...prev, isPaused: true }))
    }
  }, [state.isRecording])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isPaused) {
      mediaRecorderRef.current.resume()
      setState(prev => ({ ...prev, isPaused: false }))
    }
  }, [state.isPaused])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
  }
}
