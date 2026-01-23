'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'solid'
}

export function Card({ children, className, variant = 'default' }: CardProps) {
  const variants = {
    default: 'node-box',
    glass: 'bg-surface/50 backdrop-blur-xl border border-border rounded-xl',
    solid: 'bg-surface-solid border border-border rounded-xl',
  }

  return (
    <div className={cn(variants[variant], className)}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('node-header', className)}>
      {children}
    </div>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}
