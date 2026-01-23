'use client'

import { useState, useRef, useCallback, ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Position {
  x: number
  y: number
}

interface DraggableNodeProps {
  id: string
  children: ReactNode
  initialPosition: Position
  onPositionChange?: (id: string, position: Position) => void
  onSizeChange?: (id: string, size: { width: number; height: number }) => void
  className?: string
}

export function DraggableNode({
  id,
  children,
  initialPosition,
  onPositionChange,
  onSizeChange,
  className,
}: DraggableNodeProps) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left click and not on interactive elements
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    const isInteractive = target.closest('input, textarea, button, select, [role="slider"], [role="switch"]')
    if (isInteractive) return

    e.preventDefault()
    e.stopPropagation()

    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: position.x,
      nodeY: position.y,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return

      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY

      const newPosition = {
        x: dragStartRef.current.nodeX + deltaX,
        y: dragStartRef.current.nodeY + deltaY,
      }

      setPosition(newPosition)
      onPositionChange?.(id, newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [id, position, onPositionChange])

  return (
    <div
      className={cn(
        'absolute select-none',
        isDragging ? 'cursor-grabbing z-50' : 'cursor-grab',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  )
}
