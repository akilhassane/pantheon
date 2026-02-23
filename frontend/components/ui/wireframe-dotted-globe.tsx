"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
  isRecording?: boolean
}

export default function RotatingEarth({ width = 800, height = 600, className = "", isRecording = false }: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isRecordingRef = useRef(isRecording)
  const audioLevelRef = useRef(0)
  const previousAudioLevelRef = useRef(0) // Track previous audio level to detect changes
  const currentScaleRef = useRef(0) // Track current scale to maintain size
  const audioFrequencyRef = useRef(0) // Track frequency/pitch for different wave patterns
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Update ref when prop changes
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  // Set up audio capture and analysis
  useEffect(() => {
    if (!isRecording) {
      // Clean up audio when not recording
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      audioLevelRef.current = 0
      return
    }

    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        const microphone = audioContext.createMediaStreamSource(stream)
        
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        microphone.connect(analyser)
        
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        
        const updateAudioLevel = () => {
          if (!analyserRef.current) return
          
          analyserRef.current.getByteFrequencyData(dataArray)
          
          // Calculate average volume (overall loudness)
          const sum = dataArray.reduce((a, b) => a + b, 0)
          const average = sum / dataArray.length
          
          // Normalize to 0-1 range and apply aggressive scaling for more dramatic effect
          audioLevelRef.current = Math.min(1, (average / 100) * 2)
          
          // Calculate frequency content (bass vs treble)
          // Low frequencies (bass) = slower, deeper waves
          // High frequencies (treble) = faster, sharper waves
          const lowFreqSum = dataArray.slice(0, dataArray.length / 4).reduce((a, b) => a + b, 0)
          const highFreqSum = dataArray.slice(dataArray.length / 2).reduce((a, b) => a + b, 0)
          const lowFreqAvg = lowFreqSum / (dataArray.length / 4)
          const highFreqAvg = highFreqSum / (dataArray.length / 2)
          
          // Frequency ratio: 0 = more bass, 1 = more treble
          const totalFreq = lowFreqAvg + highFreqAvg
          audioFrequencyRef.current = totalFreq > 0 ? highFreqAvg / totalFreq : 0.5
          
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
        }
        
        updateAudioLevel()
      })
      .catch(err => {
        console.error('Error accessing microphone:', err)
        setError('Could not access microphone')
      })

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [isRecording])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    // Function to check if light theme is active
    const isLightTheme = () => document.documentElement.classList.contains('light')

    // Set up responsive dimensions - use full screen
    const containerWidth = width
    const containerHeight = height
    const radius = Math.min(containerWidth, containerHeight) / 2.8

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    // Create projection and path generator for Canvas
    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2 - 50])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point
      let inside = false

      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }

      return inside
    }

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry

      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        // Check if point is in outer ring
        if (!pointInPolygon(point, coordinates[0])) {
          return false
        }
        // Check if point is in any hole (inner rings)
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) {
            return false // Point is in a hole
          }
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        // Check each polygon in the MultiPolygon
        for (const polygon of geometry.coordinates) {
          // Check if point is in outer ring
          if (pointInPolygon(point, polygon[0])) {
            // Check if point is in any hole
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) {
              return true
            }
          }
        }
        return false
      }

      return false
    }

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds

      const stepSize = dotSpacing * 0.08
      let pointsGenerated = 0

      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat]
          if (pointInFeature(point, feature)) {
            dots.push(point)
            pointsGenerated++
          }
        }
      }

      console.log(
        `[v0] Generated ${pointsGenerated} points for land feature:`,
        feature.properties?.featurecla || "Land",
      )
      return dots
    }

    interface DotData {
      lng: number
      lat: number
      visible: boolean
    }

    const allDots: DotData[] = []
    let landFeatures: any
    let animationTime = 0
    let graticuleProgress = 1 // 1 = fully visible, 0 = fully hidden
    let waveTransitionProgress = 0 // 0 = synchronized, 1 = full wave effect
    let circleProgress = 1 // 1 = fully visible, 0 = fully hidden

    // Helper function to draw animated graticule with erasing/writing effect
    const drawAnimatedGraticule = (progress: number, scaleFactor: number) => {
      const graticule = d3.geoGraticule()
      const lines = graticule.lines()
      
      context.strokeStyle = "#ffffff"
      context.lineWidth = 1 * scaleFactor
      context.globalAlpha = 0.25
      
      lines.forEach((line: any) => {
        const coords = line.coordinates
        if (coords.length < 2) return
        
        // Determine if this is a meridian (vertical) or parallel (horizontal)
        const isMeridian = Math.abs(coords[0][0] - coords[coords.length - 1][0]) < 0.1
        
        let visiblePoints = 0
        
        if (isMeridian) {
          // Vertical lines: erase/draw from bottom to top
          // Each vertical line animates based on its longitude position
          const lineLng = coords[0][0]
          const lngNormalized = (lineLng + 180) / 360 // 0 at -180, 1 at 180
          
          // Each line gets a time window to animate
          // Overlap the animations so there's no gap between lines
          const animationDuration = 0.15 // Each line takes 15% of total progress to complete
          const lineStartProgress = lngNormalized * (1 - animationDuration)
          const lineEndProgress = lineStartProgress + animationDuration
          
          if (progress >= lineStartProgress && progress <= lineEndProgress) {
            // This line is currently animating
            const lineProgress = (progress - lineStartProgress) / animationDuration
            visiblePoints = Math.ceil(coords.length * lineProgress)
          } else if (progress > lineEndProgress) {
            // This line has finished animating - show it completely
            visiblePoints = coords.length
          }
        } else {
          // Horizontal lines: erase/draw from left to right
          // Each point appears based on its longitude position
          const totalPoints = coords.length
          
          for (let i = 0; i < totalPoints; i++) {
            const coord = coords[i]
            const lngNormalized = (coord[0] + 180) / 360
            
            if (lngNormalized <= progress) {
              visiblePoints = i + 1
            } else {
              break
            }
          }
        }
        
        if (visiblePoints > 1) {
          // Create a partial line feature with only the visible coordinates
          const partialLine = {
            type: "LineString" as const,
            coordinates: coords.slice(0, visiblePoints)
          }
          
          // Use d3's path generator to draw the curved line
          context.beginPath()
          path(partialLine as any)
          context.stroke()
        }
      })
      
      context.globalAlpha = 1
    }

    // Helper function to apply wave displacement to a coordinate
    const applyWaveDisplacement = (lng: number, lat: number, centerX: number, centerY: number, scaleFactor: number) => {
      const projected = projection([lng, lat])
      if (!projected) return null
      
      const dx = projected[0] - centerX
      const dy = projected[1] - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance === 0) {
        return [projected[0], projected[1]] // No displacement at exact center
      }
      
      const currentScale = projection.scale()
      const normalizedDistance = distance / currentScale // 0 at center, ~1 at edge
      
      // Calculate this dot's individual transition progress based on distance
      // When starting: center dots transition first
      // When stopping: outer dots transition first
      let dotTransitionProgress = 0
      
      if (isRecordingRef.current) {
        // Transitioning TO wave: center dots first
        const dotTransitionStart = normalizedDistance * 0.5
        dotTransitionProgress = Math.max(0, Math.min(1, (waveTransitionProgress - dotTransitionStart) * 2))
      } else {
        // Transitioning FROM wave: outer dots first (reverse order)
        const dotTransitionStart = (1 - normalizedDistance) * 0.5
        dotTransitionProgress = Math.max(0, Math.min(1, (waveTransitionProgress - dotTransitionStart) * 2))
      }
      
      // Always use the wave phase (for ripple effect)
      // Audio-reactive wave spacing: high frequency = tighter waves, low frequency = wider waves
      const frequencyWaveSpacing = 60 + (audioFrequencyRef.current * 40) // 60-100
      const wavePhase = (distance / frequencyWaveSpacing) - animationTime
      const waveValue = Math.sin(wavePhase)
      
      const dirX = dx / distance
      const dirY = dy / distance
      
      // Scale displacement based on distance from center (0 at center, full at edges)
      const distanceRatio = Math.min(distance / currentScale, 1)
      
      // Fade the wave amplitude based on transition progress
      // When dotTransitionProgress = 0: no wave (synchronized at height 0)
      // When dotTransitionProgress = 1: full wave effect
      // NO base wave amplitude - only react to actual audio
      const baseWaveAmplitude = 0 // Disabled - no automatic wave
      const audioBoost = audioLevelRef.current * 20 * scaleFactor * distanceRatio * dotTransitionProgress // Reduced from 35 to 5
      const maxDisplacement = baseWaveAmplitude + audioBoost
      const offsetX = dirX * waveValue * maxDisplacement
      const offsetY = dirY * waveValue * maxDisplacement
      
      return [projected[0] + offsetX, projected[1] + offsetY]
    }

    const render = () => {
      // Handle graticule transition
      const transitionSpeed = 0.08 // Fast transition speed
      
      if (isRecordingRef.current && graticuleProgress > 0) {
        // Erasing: remove graticule before starting wave animation
        graticuleProgress = Math.max(0, graticuleProgress - transitionSpeed)
      }
      // Note: Drawing back is handled below after wave transition completes
      
      // Handle circle transition (erase after graticule)
      if (isRecordingRef.current && graticuleProgress === 0 && circleProgress > 0) {
        // Erase circle after graticule is gone
        circleProgress = Math.max(0, circleProgress - 0.06)
      }
      
      // Only animate waves when recording AND graticule is fully erased AND there's actual audio
      if (isRecordingRef.current && graticuleProgress === 0 && audioLevelRef.current > 0.05) {
        // Audio-reactive wave speed based ONLY on frequency (type of sound)
        // Low frequency (bass/voice) = slower waves (0.7x)
        // High frequency (treble/noise) = faster waves (1.5x)
        const frequencySpeedMultiplier = 0.7 + (audioFrequencyRef.current * 0.8)
        const audioReactiveSpeed = 0.06 * frequencySpeedMultiplier
        
        animationTime += audioReactiveSpeed
        // Fast transition from synchronized to wave effect
        waveTransitionProgress = Math.min(1, waveTransitionProgress + 0.04)
      } else if (waveTransitionProgress > 0) {
        // Fast reverse the wave transition when stopping
        // Don't increment animationTime - freeze the wave pattern
        waveTransitionProgress = Math.max(0, waveTransitionProgress - 0.05)
        // Don't start drawing graticule until dots are fully recentered
      } else if (!isRecordingRef.current && graticuleProgress < 1 && waveTransitionProgress === 0) {
        // Draw circle back first, then graticule
        if (circleProgress < 1) {
          circleProgress = Math.min(1, circleProgress + 0.06)
        } else {
          // Only draw graticule back after circle is complete
          graticuleProgress = Math.min(1, graticuleProgress + 0.08)
        }
      }
      
      // Clear canvas with transparent background
      context.clearRect(0, 0, containerWidth, containerHeight)

      // Audio-reactive globe scaling
      // Globe only changes size when audio level actually changes
      // Maintains current size when audio level stays the same
      let targetScaleMultiplier = 1.0
      if (isRecordingRef.current && graticuleProgress === 0) {
        const audioLevel = audioLevelRef.current
        
        // Apply threshold: ignore very quiet sounds (ambient noise)
        const threshold = 0.05
        const adjustedAudioLevel = audioLevel > threshold ? audioLevel : 0
        
        // Direct mapping: louder = bigger, quieter = smaller
        const expandRatio = Math.pow(adjustedAudioLevel, 1.5)
        targetScaleMultiplier = 1.0 + (expandRatio * 0.15) // Max 15% expansion
      }
      
      // Only update scale if audio level has changed
      const targetScale = radius * targetScaleMultiplier
      let newScale = currentScaleRef.current || radius
      
      // Check if audio level changed significantly (more than 1% difference)
      if (Math.abs(audioLevelRef.current - previousAudioLevelRef.current) > 0.01) {
        // Audio level changed - update scale
        newScale = targetScale
        previousAudioLevelRef.current = audioLevelRef.current
        currentScaleRef.current = newScale
      } else {
        // Audio level unchanged - maintain current scale
        newScale = currentScaleRef.current || radius
      }
      
      const currentScale = newScale
      projection.scale(newScale)
      
      const scaleFactor = newScale / radius

      // Draw ocean (globe background) with animated circle
      if (circleProgress > 0) {
        // When erasing (progress going 1->0): draw from end backwards (clockwise erase)
        // When drawing (progress going 0->1): draw from start forwards (clockwise draw)
        const startAngle = -Math.PI / 2 // Start at top (12 o'clock)
        const totalAngle = 2 * Math.PI
        
        let drawStartAngle, drawEndAngle
        
        if (isRecordingRef.current) {
          // Erasing: draw the remaining part (clockwise erase effect)
          drawStartAngle = startAngle + (totalAngle * (1 - circleProgress))
          drawEndAngle = startAngle + totalAngle
        } else {
          // Drawing: draw from start (clockwise draw effect)
          drawStartAngle = startAngle
          drawEndAngle = startAngle + (totalAngle * circleProgress)
        }
        
        context.beginPath()
        context.arc(containerWidth / 2, containerHeight / 2 - 50, currentScale, drawStartAngle, drawEndAngle)
        
        // Use #E5E5E5 in light theme, white in dark theme
        context.strokeStyle = isLightTheme() ? "#E5E5E5" : "#ffffff"
        context.lineWidth = 2 * scaleFactor
        context.stroke()
      }

      if (landFeatures) {
        // Draw graticule with animation
        if (graticuleProgress > 0) {
          drawAnimatedGraticule(graticuleProgress, scaleFactor)
        }
        const centerX = containerWidth / 2
        const centerY = containerHeight / 2 - 50

        // Draw land outlines with wave displacement when recording AND graticule is fully erased
        context.strokeStyle = "#ffffff"
        context.lineWidth = 1 * scaleFactor
        
        if ((isRecordingRef.current && graticuleProgress === 0) || waveTransitionProgress > 0) {
          landFeatures.features.forEach((feature: any) => {
            const drawPolygon = (coords: any) => {
              context.beginPath()
              let firstPoint = true
              coords.forEach((coord: [number, number]) => {
                const displaced = applyWaveDisplacement(coord[0], coord[1], centerX, centerY, scaleFactor)
                if (displaced) {
                  if (firstPoint) {
                    context.moveTo(displaced[0], displaced[1])
                    firstPoint = false
                  } else {
                    context.lineTo(displaced[0], displaced[1])
                  }
                }
              })
              context.closePath()
              context.stroke()
            }

            if (feature.geometry.type === "Polygon") {
              feature.geometry.coordinates.forEach((ring: any) => {
                drawPolygon(ring)
              })
            } else if (feature.geometry.type === "MultiPolygon") {
              feature.geometry.coordinates.forEach((polygon: any) => {
                polygon.forEach((ring: any) => {
                  drawPolygon(ring)
                })
              })
            }
          })
        } else {
          // Draw static land outlines when not recording
          context.beginPath()
          landFeatures.features.forEach((feature: any) => {
            path(feature)
          })
          context.stroke()
        }

        // Draw halftone dots with wave animation when recording
        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            let finalX = projected[0]
            let finalY = projected[1]
            
            if ((isRecordingRef.current && graticuleProgress === 0) || waveTransitionProgress > 0) {
              // Calculate direction from center to dot (radial direction)
              const dx = projected[0] - centerX
              const dy = projected[1] - centerY
              const distance = Math.sqrt(dx * dx + dy * dy)
              
              if (distance > 0) {
                const normalizedDistance = distance / currentScale // 0 at center, ~1 at edge
                
                // Calculate this dot's individual transition progress based on distance
                // When starting: center dots transition first
                // When stopping: outer dots transition first
                let dotTransitionProgress = 0
                
                if (isRecordingRef.current) {
                  // Transitioning TO wave: center dots first
                  const dotTransitionStart = normalizedDistance * 0.5
                  dotTransitionProgress = Math.max(0, Math.min(1, (waveTransitionProgress - dotTransitionStart) * 2))
                } else {
                  // Transitioning FROM wave: outer dots first (reverse order)
                  const dotTransitionStart = (1 - normalizedDistance) * 0.5
                  dotTransitionProgress = Math.max(0, Math.min(1, (waveTransitionProgress - dotTransitionStart) * 2))
                }
                
                // Always use the wave phase (for ripple effect)
                // Audio-reactive wave spacing: high frequency = tighter waves, low frequency = wider waves
                const frequencyWaveSpacing = 60 + (audioFrequencyRef.current * 40) // 60-100
                const wavePhase = (distance / frequencyWaveSpacing) - animationTime
                const waveValue = Math.sin(wavePhase)
                
                // Normalize direction
                const dirX = dx / distance
                const dirY = dy / distance
                
                // Scale displacement based on distance from center (0 at center, full at edges)
                const distanceRatio = Math.min(distance / currentScale, 1)
                
                // Fade the wave amplitude based on transition progress
                // When dotTransitionProgress = 0: no wave (synchronized at height 0)
                // When dotTransitionProgress = 1: full wave effect
                // NO base wave amplitude - only react to actual audio
                const baseWaveAmplitude = 0 // Disabled - no automatic wave
                const audioBoost = audioLevelRef.current * 20 * scaleFactor * distanceRatio * dotTransitionProgress // Reduced from 35 to 5
                const maxDisplacement = baseWaveAmplitude + audioBoost
                const offsetX = dirX * waveValue * maxDisplacement
                const offsetY = dirY * waveValue * maxDisplacement
                
                finalX = projected[0] + offsetX
                finalY = projected[1] + offsetY
              }
            }
            
            context.beginPath()
            context.arc(finalX, finalY, 1.2 * scaleFactor, 0, 2 * Math.PI)
            context.fillStyle = "#999999"
            context.fill()
          }
        })
      }
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        )
        if (!response.ok) throw new Error("Failed to load land data")

        landFeatures = await response.json()

        // Generate dots for all land features
        let totalDots = 0
        landFeatures.features.forEach((feature: any) => {
          const dots = generateDotsInPolygon(feature, 16)
          dots.forEach(([lng, lat]) => {
            allDots.push({ lng, lat, visible: true })
            totalDots++
          })
        })

        console.log(`[v0] Total dots generated: ${totalDots} across ${landFeatures.features.length} land features`)

        render()
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load land map data")
        setIsLoading(false)
      }
    }

    // Set up rotation and interaction
    const rotation: [number, number] = [0, 0]
    let autoRotate = true
    const rotationSpeed = 0.2 // Slower rotation for peaceful effect

    const rotate = () => {
      if (autoRotate) {
        rotation[0] += rotationSpeed
        projection.rotate(rotation)
      }
      // Always render to keep wave animation going when recording
      render()
    }

    // Auto-rotation timer
    const rotationTimer = d3.timer(rotate)

    const handleMouseDown = (event: MouseEvent) => {
      autoRotate = false
      const startX = event.clientX
      const startY = event.clientY
      const startRotation: [number, number] = [rotation[0], rotation[1]]

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const sensitivity = 0.5
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY

        rotation[0] = startRotation[0] + dx * sensitivity
        rotation[1] = startRotation[1] - dy * sensitivity
        rotation[1] = Math.max(-90, Math.min(90, rotation[1]))

        projection.rotate(rotation)
        render()
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        setTimeout(() => {
          autoRotate = true
        }, 10)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
      const currentScale = projection.scale()
      const newScale = Math.max(radius * 0.5, Math.min(radius * 3, currentScale * scaleFactor))
      projection.scale(newScale)
      // Keep the same center position
      projection.translate([containerWidth / 2, containerHeight / 2 - 50])
      render()
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("wheel", handleWheel)

    // Listen for theme changes and re-render
    const handleThemeChange = () => {
      render()
    }
    window.addEventListener('theme-changed', handleThemeChange)

    // Also observe class changes on documentElement
    const observer = new MutationObserver(() => {
      render()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    // Load the world data
    loadWorldData()

    // Cleanup
    return () => {
      rotationTimer.stop()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("wheel", handleWheel)
      window.removeEventListener('theme-changed', handleThemeChange)
      observer.disconnect()
    }
  }, [width, height])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center bg-card rounded-2xl p-8 ${className}`}>
        <div className="text-center">
          <p className="dark text-red-600 font-semibold mb-2">Error loading Earth visualization</p>
          <p className="dark text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="rounded-2xl dark"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
