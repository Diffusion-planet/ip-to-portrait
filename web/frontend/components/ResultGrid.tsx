'use client'

import { cn } from '@/lib/utils'
import {
  ExpandIcon,
  BookmarkIcon,
  DownloadIcon,
  RefreshIcon,
} from '@/components/icons'

interface ResultItem {
  id: string
  imageUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
}

interface ResultGridProps {
  results: ResultItem[]
  onExpand?: (id: string) => void
  onBookmark?: (id: string) => void
  onDownload?: (id: string) => void
  onRegenerate?: (id: string) => void
  className?: string
}

export function ResultGrid({
  results,
  onExpand,
  onBookmark,
  onDownload,
  onRegenerate,
  className,
}: ResultGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {results.map((result) => (
        <ResultCard
          key={result.id}
          result={result}
          onExpand={() => onExpand?.(result.id)}
          onBookmark={() => onBookmark?.(result.id)}
          onDownload={() => onDownload?.(result.id)}
          onRegenerate={() => onRegenerate?.(result.id)}
        />
      ))}
    </div>
  )
}

interface ResultCardProps {
  result: ResultItem
  onExpand?: () => void
  onBookmark?: () => void
  onDownload?: () => void
  onRegenerate?: () => void
}

function ResultCard({
  result,
  onExpand,
  onBookmark,
  onDownload,
  onRegenerate,
}: ResultCardProps) {
  const { status, imageUrl, progress = 0, error } = result

  return (
    <div className="relative group rounded-lg overflow-hidden bg-surface border border-border aspect-square">
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
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Expand"
            >
              <ExpandIcon size={16} className="text-white" />
            </button>
            <button
              onClick={onBookmark}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Bookmark"
            >
              <BookmarkIcon size={16} className="text-white" />
            </button>
            <button
              onClick={onDownload}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Download"
            >
              <DownloadIcon size={16} className="text-white" />
            </button>
            <button
              onClick={onRegenerate}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Regenerate"
            >
              <RefreshIcon size={16} className="text-white" />
            </button>
          </div>
        </>
      ) : status === 'processing' ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[rgba(255,255,255,0.03)]">
          <div className="relative w-12 h-12 mb-3">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 1.26} 126`}
              />
            </svg>
          </div>
          <span className="text-sm text-[#888]">{progress}%</span>
        </div>
      ) : status === 'failed' ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 rounded-full bg-accent-red/20 flex items-center justify-center mb-2">
            <span className="text-accent-red text-lg">!</span>
          </div>
          <span className="text-xs text-text-secondary text-center">
            {error || 'Generation failed'}
          </span>
          <button
            onClick={onRegenerate}
            className="mt-2 px-3 py-1 rounded text-xs bg-white/10 hover:bg-white/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-text-secondary animate-spin" />
        </div>
      )}
    </div>
  )
}

// Compact version for sidebar/panel
interface CompactResultGridProps {
  results: ResultItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  className?: string
}

export function CompactResultGrid({
  results,
  selectedId,
  onSelect,
  className,
}: CompactResultGridProps) {
  return (
    <div className={cn('grid grid-cols-4 gap-1', className)}>
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => result.status === 'completed' && onSelect?.(result.id)}
          className={cn(
            'relative aspect-square rounded overflow-hidden border-2 transition-colors',
            result.id === selectedId
              ? 'border-white/40'
              : 'border-transparent hover:border-white/10',
            result.status !== 'completed' && 'opacity-50 cursor-not-allowed'
          )}
        >
          {result.imageUrl ? (
            <img
              src={result.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : result.status === 'processing' ? (
            <div className="w-full h-full bg-surface flex items-center justify-center">
              <div className="w-4 h-4 border border-text-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="w-full h-full bg-surface" />
          )}
        </button>
      ))}
    </div>
  )
}
