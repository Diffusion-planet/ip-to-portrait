'use client'

import { cn } from '@/lib/utils'
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs text-text-secondary">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'input-field min-h-[80px] resize-none nodrag',
            error && 'border-accent-red',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-accent-red">{error}</p>
        )}
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'
