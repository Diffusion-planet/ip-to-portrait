'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface Point {
  x: number
  y: number
}

interface ConnectionLineProps {
  from: Point
  to: Point
  active?: boolean
  thick?: boolean
  className?: string
}

export function ConnectionLine({
  from,
  to,
  active = false,
  thick = false,
  className,
}: ConnectionLineProps) {
  // Calculate control points for bezier curve
  const dx = to.x - from.x
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100)

  const path = `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`

  return (
    <path
      d={path}
      className={cn(
        'connection-line',
        active && 'active',
        thick && 'thick',
        className
      )}
    />
  )
}

interface ConnectionSpec {
  id: string
  fromNodeId: string
  fromPortId: string
  toNodeId: string
  toPortId: string
  active?: boolean
  thick?: boolean
}

interface ConnectionLayerProps {
  connections: ConnectionSpec[]
}

export function ConnectionLayer({ connections }: ConnectionLayerProps) {
  const [portPositions, setPortPositions] = useState<Map<string, Point>>(new Map())

  useEffect(() => {
    const updatePortPositions = () => {
      const positions = new Map<string, Point>()

      // Find all port elements and get their positions
      const portElements = document.querySelectorAll('[data-port-id]')
      portElements.forEach((el) => {
        const nodeId = el.getAttribute('data-node-id')
        const portId = el.getAttribute('data-port-id')
        const portType = el.getAttribute('data-port-type')

        if (nodeId && portId && portType) {
          const rect = el.getBoundingClientRect()
          const key = `${nodeId}-${portId}-${portType}`
          positions.set(key, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        }
      })

      setPortPositions(positions)
    }

    // Initial update
    updatePortPositions()

    // Update on window resize and periodically to catch any layout changes
    window.addEventListener('resize', updatePortPositions)
    const interval = setInterval(updatePortPositions, 100)

    return () => {
      window.removeEventListener('resize', updatePortPositions)
      clearInterval(interval)
    }
  }, [connections])

  const renderedConnections = connections.map((conn) => {
    const fromKey = `${conn.fromNodeId}-${conn.fromPortId}-output`
    const toKey = `${conn.toNodeId}-${conn.toPortId}-input`

    const from = portPositions.get(fromKey) || { x: 0, y: 0 }
    const to = portPositions.get(toKey) || { x: 0, y: 0 }

    return {
      id: conn.id,
      from,
      to,
      active: conn.active,
      thick: conn.thick,
    }
  })

  return (
    <svg
      className="absolute pointer-events-none z-10"
      style={{
        top: 0,
        left: 0,
        width: '5000px',
        height: '5000px',
        overflow: 'visible',
      }}
    >
      {renderedConnections.map((conn) => (
        <g key={conn.id}>
          <ConnectionLine
            from={conn.from}
            to={conn.to}
            active={conn.active}
            thick={conn.thick}
          />
          {/* Port circles at endpoints */}
          <circle
            cx={conn.from.x}
            cy={conn.from.y}
            r={4}
            fill={conn.active ? '#777' : '#444'}
          />
          <circle
            cx={conn.to.x}
            cy={conn.to.y}
            r={4}
            fill={conn.active ? '#777' : '#444'}
          />
        </g>
      ))}
    </svg>
  )
}
