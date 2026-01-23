'use client'

import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: ToggleProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {label && (
        <span className="text-xs text-[#a0a0a0]">{label}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 nodrag',
          checked ? 'bg-[rgba(255,255,255,0.35)]' : 'bg-[rgba(255,255,255,0.1)]',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'absolute left-0 top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200',
            checked ? 'translate-x-[30px]' : 'translate-x-[2px]'
          )}
        />
      </button>
    </div>
  )
}
