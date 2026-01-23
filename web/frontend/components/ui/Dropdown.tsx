'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select...',
  disabled,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && (
        <span className="text-xs text-[#a0a0a0] min-w-[80px]">{label}</span>
      )}
      <div ref={containerRef} className="relative flex-1 nodrag">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-5 py-4 rounded-[14px] text-xl',
            'bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)]',
            'hover:border-[rgba(255,255,255,0.15)]',
            'transition-colors outline-none focus:outline-none',
            isOpen && 'border-[rgba(255,255,255,0.2)]',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer'
          )}
        >
          <span className={selectedOption ? 'text-white' : 'text-[#666]'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              'w-6 h-6 text-[#666] transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 py-2 rounded-[14px] z-50 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] shadow-xl">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full px-5 py-3 text-xl text-left transition-colors',
                  option.value === value
                    ? 'text-white bg-[rgba(255,255,255,0.1)]'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
