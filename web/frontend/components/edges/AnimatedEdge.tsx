'use client'

import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isActive = data?.active || false

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: isActive ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255, 255, 255, 0.2)',
          filter: isActive ? 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.8))' : 'none',
        }}
      />
      {isActive && (
        <>
          <circle r="4" fill="rgba(74, 222, 128, 1)">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="4" fill="rgba(74, 222, 128, 1)">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="0.5s" />
          </circle>
          <circle r="4" fill="rgba(74, 222, 128, 1)">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="1s" />
          </circle>
        </>
      )}
    </>
  )
}
