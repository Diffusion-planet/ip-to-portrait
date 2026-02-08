'use client'

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  showValue?: boolean
  className?: string
  disabled?: boolean
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  showValue = true,
  className,
  disabled,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const percentage = ((value - min) / (max - min)) * 100

  const updateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current || disabled) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const pct = x / rect.width
      const newValue = min + pct * (max - min)
      const steppedValue = Math.round(newValue / step) * step
      onChange(Math.max(min, Math.min(max, steppedValue)))
    },
    [min, max, step, onChange, disabled]
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    e.stopPropagation()
    setIsDragging(true)
    updateValue(e.clientX)

    const handleMouseMove = (e: MouseEvent) => {
      e.stopPropagation()
      updateValue(e.clientX)
    }

    const handleMouseUp = (e: MouseEvent) => {
      e.stopPropagation()
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
    }

    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mouseup', handleMouseUp, true)
  }

  const formatValue = (v: number) => {
    if (max <= 1) return v.toFixed(2)
    if (step >= 1) return v.toFixed(0)
    return v.toFixed(1)
  }

  return (
    <div className={cn('flex items-center gap-3 nodrag', className)}>
      {label && (
        <span className="text-xs text-[#a0a0a0] min-w-[80px]">{label}</span>
      )}
      <div className="flex-1 flex items-center gap-2 nodrag">
        <div
          ref={trackRef}
          className={cn(
            'relative h-6 flex-1 rounded-full cursor-pointer nodrag nopan flex items-center',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onMouseDown={handleMouseDown}
        >
          {/* Visual track */}
          <div className="absolute left-0 right-0 h-1 rounded-full bg-[rgba(255,255,255,0.1)]" />
          {/* Fill */}
          <div
            className="absolute left-0 h-1 rounded-full bg-[rgba(255,255,255,0.25)] transition-all pointer-events-none"
            style={{ width: `${percentage}%` }}
          />
          {/* Thumb */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-md transition-transform pointer-events-none',
              isDragging && 'scale-110'
            )}
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>
        {showValue && (
          <span className="text-xs text-white font-mono min-w-[40px] text-right">
            {formatValue(value)}
          </span>
        )}
      </div>
    </div>
  )
}
