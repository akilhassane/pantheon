'use client'

import React, { useEffect, useRef, ReactNode } from 'react'

interface SmokeProps {
  children: ReactNode
  density?: number
  color?: string
  opacity?: number
}

export const Smoke = React.forwardRef<HTMLDivElement, SmokeProps>(
  ({ children, density = 75, color = '#cccccc', opacity = 0.7 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const particles: Array<{
        x: number
        y: number
        vx: number
        vy: number
        life: number
        maxLife: number
        size: number
        rotation: number
        rotationSpeed: number
      }> = []
      let animationId: number

      const resizeCanvas = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      resizeCanvas()

      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
      }

      const createParticle = () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1 - 0.5,
        life: 1,
        maxLife: Math.random() * 3 + 2,
        size: Math.random() * 80 + 40,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
      })

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const particlesToAdd = density / 100
        for (let i = 0; i < particlesToAdd; i++) {
          particles.push(createParticle())
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]

          p.vx += (Math.random() - 0.5) * 0.02
          p.rotation += p.rotationSpeed
          p.vy -= 0.3
          p.x += p.vx
          p.y += p.vy
          p.life -= 1 / (p.maxLife * 60)

          if (p.life < 0) p.life = 0

          ctx.save()
          ctx.globalAlpha = p.life * opacity

          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
          gradient.addColorStop(0.5, hexToRgba(color, 0.7))
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

          ctx.fillStyle = gradient
          ctx.filter = 'blur(20px)'
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()

          if (p.life <= 0 || p.y < -100) {
            particles.splice(i, 1)
          }
        }

        animationId = requestAnimationFrame(animate)
      }

      animate()

      const handleResize = () => {
        resizeCanvas()
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        cancelAnimationFrame(animationId)
      }
    }, [density, color, opacity])

    return (
      <div className="relative w-full h-full overflow-hidden" ref={ref}>
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        />
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>
      </div>
    )
  }
)

Smoke.displayName = 'Smoke'
