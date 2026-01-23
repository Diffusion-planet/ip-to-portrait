'use client'

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CanvasProps {
  children: ReactNode
  className?: string
  showGrid?: boolean
  zoom?: number
  onZoomChange?: (zoom: number) => void
}

export function Canvas({
  children,
  className,
  showGrid = true,
  zoom = 1,
  onZoomChange,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 40, y: 30 }) // Minimal offset - nodes already positioned well
  const startPanRef = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start pan if clicking directly on canvas (not on children)
    if (e.target === canvasRef.current || e.target === canvasRef.current?.firstChild) {
      e.preventDefault()
      setIsPanning(true)
      startPanRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
    }
  }, [panOffset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      })
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const newZoom = Math.max(0.25, Math.min(2, zoom + delta))
      onZoomChange?.(newZoom)
    }
  }, [zoom, onZoomChange])

  // Prevent default wheel behavior for zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleNativeWheel)
  }, [])

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full overflow-hidden cursor-grab',
        showGrid && 'canvas-area',
        isPanning && 'cursor-grabbing',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute origin-top-left pointer-events-none"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        }}
      >
        <div className="pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
