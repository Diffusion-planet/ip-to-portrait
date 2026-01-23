'use client'

import {
  PlusIcon,
  MinusIcon,
  GridIcon,
  EyeIcon,
  LinkIcon,
} from '@/components/icons'

interface SideToolsProps {
  onZoomIn?: () => void
  onZoomOut?: () => void
  onToggleGrid?: () => void
  onToggleFocusMode?: () => void
  onToggleConnections?: () => void
  showGrid?: boolean
  focusMode?: boolean
  showConnections?: boolean
}

export function SideTools({
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onToggleFocusMode,
  onToggleConnections,
  showGrid = true,
  focusMode = false,
  showConnections = true,
}: SideToolsProps) {
  return (
    <div className="side-tools">
      <button
        className="side-tool-btn"
        onClick={onZoomIn}
        title="Zoom In"
      >
        <PlusIcon size={16} />
      </button>

      <button
        className="side-tool-btn"
        onClick={onZoomOut}
        title="Zoom Out"
      >
        <MinusIcon size={16} />
      </button>

      <div className="w-full h-px bg-border my-1" />

      <button
        className={`side-tool-btn ${showGrid ? 'text-white bg-white/10' : ''}`}
        onClick={onToggleGrid}
        title="Toggle Grid"
      >
        <GridIcon size={16} />
      </button>

      <button
        className={`side-tool-btn ${focusMode ? 'text-white bg-white/10' : ''}`}
        onClick={onToggleFocusMode}
        title="Focus Mode (Hide UI)"
      >
        <EyeIcon size={16} />
      </button>

      <button
        className={`side-tool-btn ${showConnections ? 'text-white bg-white/10' : ''}`}
        onClick={onToggleConnections}
        title="Toggle Connections"
      >
        <LinkIcon size={16} />
      </button>
    </div>
  )
}
