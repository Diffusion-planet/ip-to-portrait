'use client'

import { cn } from '@/lib/utils'

type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'pink' | 'purple' | 'orange'

interface PortBadgeProps {
  color: BadgeColor
  className?: string
  'data-node-id'?: string
  'data-port-id'?: string
  'data-port-type'?: 'input' | 'output'
}

const colorStyles: Record<BadgeColor, string> = {
  green: 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]',
  yellow: 'bg-[#eab308] shadow-[0_0_8px_#eab308]',
  red: 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]',
  blue: 'bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]',
  pink: 'bg-[#ec4899] shadow-[0_0_8px_#ec4899]',
  purple: 'bg-[#a855f7] shadow-[0_0_8px_#a855f7]',
  orange: 'bg-[#f97316] shadow-[0_0_8px_#f97316]',
}

export function PortBadge({ color, className, ...dataProps }: PortBadgeProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        colorStyles[color],
        className
      )}
      {...dataProps}
    />
  )
}
