'use client'

import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  disabled?: boolean
  className?: string
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  disabled,
  className,
}: NumberStepperProps) {
  const decrement = () => {
    if (disabled) return
    onChange(Math.max(min, value - step))
  }

  const increment = () => {
    if (disabled) return
    onChange(Math.min(max, value + step))
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && (
        <span className="text-xs text-[#a0a0a0] min-w-[80px]">{label}</span>
      )}
      <div className="flex items-center gap-1 nodrag">
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || value <= min}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded text-[#a0a0a0] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors',
            (disabled || value <= min) && 'opacity-30 cursor-not-allowed'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="w-16 text-center text-lg text-white bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] rounded-md py-2">
          {value}
        </div>
        <button
          type="button"
          onClick={increment}
          disabled={disabled || value >= max}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded text-[#a0a0a0] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors',
            (disabled || value >= max) && 'opacity-30 cursor-not-allowed'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
