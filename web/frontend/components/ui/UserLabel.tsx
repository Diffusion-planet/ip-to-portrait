'use client'

import { cn } from '@/lib/utils'

type LabelColor = 'yellow' | 'pink' | 'blue' | 'green'

interface UserLabelProps {
  name: string
  color: LabelColor
  className?: string
}

const colorStyles: Record<LabelColor, string> = {
  yellow: 'bg-[#eab308] text-black',
  pink: 'bg-[#ec4899] text-white',
  blue: 'bg-[#3b82f6] text-white',
  green: 'bg-[#22c55e] text-black',
}

export function UserLabel({ name, color, className }: UserLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded',
        colorStyles[color],
        className
      )}
    >
      {name}
    </span>
  )
}
