'use client'

import { useMemo } from 'react'
import { NodeBox } from './NodeBox'
import { ExpandIcon, DownloadIcon } from '@/components/icons'

interface ResultItem {
  id: string
  imageUrl?: string
  previewUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
}

interface ResultsNodeProps {
  id: string
  results: ResultItem[]
  count: number
  onExpand?: (resultId: string) => void
  onDownload?: (resultId: string) => void
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  active?: boolean
}

export function ResultsNode({
  id,
  results,
  count,
  onExpand,
  onDownload,
  onPortClick,
  selected,
  active,
}: ResultsNodeProps) {
  // Calculate grid columns based on count
  const columns = useMemo(() => {
    if (count === 1) return 1
    if (count <= 4) return 2
    return 3
  }, [count])

  // Create display items (results or placeholders)
  const displayItems = useMemo(() => {
    const items: (ResultItem | { id: string; placeholder: true })[] = []

    // Add actual results
    for (let i = 0; i < count; i++) {
      if (results[i]) {
        items.push(results[i])
      } else {
        items.push({ id: `placeholder-${i}`, placeholder: true })
      }
    }

    return items
  }, [results, count])

  const nodeWidth = useMemo(() => {
    if (count === 1) return 'w-[400px]'
    if (count <= 4) return 'w-[700px]'
    return 'w-[900px]'
  }, [count])

  return (
    <NodeBox
      id={id}
      title={`Results (${results.filter(r => r.status === 'completed').length}/${count})`}
      onPortClick={onPortClick}
      selected={selected}
      active={active}
      className={nodeWidth}
      skipContentWrapper={true}
    >
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {displayItems.map((item) => (
          'placeholder' in item ? (
            <PlaceholderCard key={item.id} />
          ) : (
            <ResultCard
              key={item.id}
              result={item}
              onExpand={() => onExpand?.(item.id)}
              onDownload={() => onDownload?.(item.id)}
            />
          )
        ))}
      </div>
    </NodeBox>
  )
}

function PlaceholderCard() {
  return (
    <div className="aspect-[3/4] rounded-[18px] bg-[#2a2a2a] border border-dashed border-[rgba(255,255,255,0.15)] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-[rgba(255,255,255,0.15)]" />
    </div>
  )
}

interface ResultCardProps {
  result: ResultItem
  onExpand?: () => void
  onDownload?: () => void
}

function ResultCard({ result, onExpand, onDownload }: ResultCardProps) {
  const { status, imageUrl, previewUrl, progress = 0, error } = result

  return (
    <div className="relative group rounded-[18px] overflow-hidden bg-[#2a2a2a] border border-[rgba(255,255,255,0.15)] aspect-[3/4]">
      {status === 'completed' && imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt="Generated"
            className="w-full h-full object-cover"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={onExpand}
              className="p-2 rounded-[14px] bg-white/10 hover:bg-white/20 transition-colors"
              title="Expand"
            >
              <ExpandIcon size={14} className="text-white" />
            </button>
            <button
              onClick={onDownload}
              className="p-2 rounded-[14px] bg-white/10 hover:bg-white/20 transition-colors"
              title="Download"
            >
              <DownloadIcon size={14} className="text-white" />
            </button>
          </div>
        </>
      ) : status === 'processing' ? (
        <div className="relative w-full h-full">
          {/* Preview image if available */}
          {previewUrl && (
            <img
              key={previewUrl}
              src={`http://localhost:8008${previewUrl}`}
              alt="Preview"
              className="w-full h-full object-cover opacity-80"
            />
          )}
          {/* Progress overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <div className="relative w-10 h-10 mb-2">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 1.005} 100.5`}
                />
              </svg>
            </div>
            <span className="text-xs text-white font-medium">{progress}%</span>
          </div>
        </div>
      ) : status === 'failed' ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-2">
          <div className="w-8 h-8 rounded-full bg-accent-red/20 flex items-center justify-center mb-1">
            <span className="text-accent-red text-sm">!</span>
          </div>
          <span className="text-[10px] text-text-secondary text-center line-clamp-2">
            {error || 'Failed'}
          </span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-[rgba(255,255,255,0.15)] border-t-text-secondary animate-spin" />
        </div>
      )}
    </div>
  )
}
