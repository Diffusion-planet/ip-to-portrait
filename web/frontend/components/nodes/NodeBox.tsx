'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { PortBadge } from '@/components/ui'

type PortColor = 'green' | 'yellow' | 'red' | 'blue' | 'pink' | 'purple' | 'orange'

export interface Port {
  id: string
  label: string
  color: PortColor
  type: 'input' | 'output'
}

interface NodeBoxProps {
  id: string
  title: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  selected?: boolean
  active?: boolean
  inputPorts?: Port[]
  outputPorts?: Port[]
  headerRight?: ReactNode
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  skipContentWrapper?: boolean
}

export function NodeBox({
  id,
  title,
  children,
  className,
  style,
  selected = false,
  active = false,
  inputPorts = [],
  outputPorts = [],
  headerRight,
  onPortClick,
  skipContentWrapper = false,
}: NodeBoxProps) {
  return (
    <div
      className={cn(
        'node-box min-w-[240px]',
        selected && 'selected',
        active && 'active-node',
        className
      )}
      style={style}
      data-node-id={id}
    >
      {/* Header */}
      <div className="node-header">
        <div className="w-2 h-2 rounded-full bg-white opacity-60" />
        <span className="node-title flex-1">{title}</span>
        {headerRight}
      </div>

      {skipContentWrapper ? (
        /* No wrapper - content directly inside glass */
        <div className="px-6 pb-6 space-y-5">
          {/* Input Ports */}
          {inputPorts.length > 0 && (
            <div className="space-y-2.5">
              {inputPorts.map((port) => (
                <div
                  key={port.id}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => onPortClick?.(port.id, 'input')}
                >
                  <PortBadge
                    color={port.color}
                    data-node-id={id}
                    data-port-id={port.id}
                    data-port-type="input"
                  />
                  <span className="text-xl text-[#888] group-hover:text-white transition-colors font-medium">
                    {port.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            {children}
          </div>

          {/* Output Ports */}
          {outputPorts.length > 0 && (
            <div className="space-y-2.5">
              {outputPorts.map((port) => (
                <div
                  key={port.id}
                  className="flex items-center justify-end gap-2 cursor-pointer group"
                  onClick={() => onPortClick?.(port.id, 'output')}
                >
                  <span className="text-xl text-[#888] group-hover:text-white transition-colors font-medium">
                    {port.label}
                  </span>
                  <PortBadge
                    color={port.color}
                    data-node-id={id}
                    data-port-id={port.id}
                    data-port-type="output"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Single opaque box containing all content */
        <div className="mx-6 mb-6 bg-[#1a1a1a] rounded-xl p-5 space-y-5">
          {/* Input Ports */}
          {inputPorts.length > 0 && (
            <div className="space-y-2.5">
              {inputPorts.map((port) => (
                <div
                  key={port.id}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => onPortClick?.(port.id, 'input')}
                >
                  <PortBadge
                    color={port.color}
                    data-node-id={id}
                    data-port-id={port.id}
                    data-port-type="input"
                  />
                  <span className="text-xl text-[#888] group-hover:text-white transition-colors font-medium">
                    {port.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            {children}
          </div>

          {/* Output Ports */}
          {outputPorts.length > 0 && (
            <div className="space-y-2.5">
              {outputPorts.map((port) => (
                <div
                  key={port.id}
                  className="flex items-center justify-end gap-2 cursor-pointer group"
                  onClick={() => onPortClick?.(port.id, 'output')}
                >
                  <span className="text-xl text-[#888] group-hover:text-white transition-colors font-medium">
                    {port.label}
                  </span>
                  <PortBadge
                    color={port.color}
                    data-node-id={id}
                    data-port-id={port.id}
                    data-port-type="output"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
