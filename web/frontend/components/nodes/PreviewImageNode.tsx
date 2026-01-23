'use client'

import { NodeBox, Port } from './NodeBox'
import { Dropdown } from '@/components/ui'
import { ExpandIcon, BookmarkIcon, CopyIcon, RefreshIcon, DownloadIcon } from '@/components/icons'

interface PreviewImageNodeProps {
  id: string
  imageSrc?: string
  title?: string
  description?: string
  scale?: string
  format?: string
  onScaleChange?: (scale: string) => void
  onFormatChange?: (format: string) => void
  onExpand?: () => void
  onBookmark?: () => void
  onCopy?: () => void
  onRefresh?: () => void
  onDownload?: () => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  isGenerating?: boolean
  progress?: number
}

const SCALE_OPTIONS = [
  { value: '1x', label: '1x' },
  { value: '2x', label: '2x' },
  { value: '4x', label: '4x' },
]

const FORMAT_OPTIONS = [
  { value: 'PNG', label: 'PNG' },
  { value: 'JPG', label: 'JPG' },
  { value: 'WEBP', label: 'WEBP' },
]

export function PreviewImageNode({
  id,
  imageSrc,
  title = 'Final Result',
  description,
  scale = '2x',
  format = 'PNG',
  onScaleChange,
  onFormatChange,
  onExpand,
  onBookmark,
  onCopy,
  onRefresh,
  onDownload,
  onPortClick,
  selected,
  isGenerating,
  progress,
}: PreviewImageNodeProps) {
  const inputPorts: Port[] = [
    { id: 'image', label: 'image', color: 'blue', type: 'input' },
  ]

  return (
    <NodeBox
      id={id}
      title="Preview Image"
      inputPorts={inputPorts}
      onPortClick={onPortClick}
      selected={selected}
      className="w-[280px]"
    >
      <div className="space-y-3">
        {/* Image Preview */}
        <div className="relative aspect-square rounded-lg overflow-hidden preview-image-container">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[rgba(255,255,255,0.03)]">
              {isGenerating ? (
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  {progress !== undefined && (
                    <span className="text-xs text-[#888]">{progress}%</span>
                  )}
                </div>
              ) : (
                <span className="text-[#666] text-sm">No image</span>
              )}
            </div>
          )}

          {/* Overlay text */}
          {imageSrc && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <h4 className="text-sm font-medium text-white">{title}</h4>
              {description && (
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-surface-solid/50">
          <button
            onClick={onExpand}
            className="side-tool-btn"
            title="Expand"
          >
            <ExpandIcon size={14} />
          </button>
          <button
            onClick={onBookmark}
            className="side-tool-btn"
            title="Bookmark"
          >
            <BookmarkIcon size={14} />
          </button>
          <button
            onClick={onCopy}
            className="side-tool-btn"
            title="Copy"
          >
            <CopyIcon size={14} />
          </button>
          <button
            onClick={onRefresh}
            className="side-tool-btn"
            title="Regenerate"
          >
            <RefreshIcon size={14} />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          <Dropdown
            value={scale}
            onChange={onScaleChange || (() => {})}
            options={SCALE_OPTIONS}
            className="w-14 text-xs"
          />

          <Dropdown
            value={format}
            onChange={onFormatChange || (() => {})}
            options={FORMAT_OPTIONS}
            className="w-16 text-xs"
          />

          <button
            onClick={onDownload}
            className="side-tool-btn"
            title="Download"
          >
            <DownloadIcon size={14} />
          </button>
        </div>
      </div>
    </NodeBox>
  )
}
