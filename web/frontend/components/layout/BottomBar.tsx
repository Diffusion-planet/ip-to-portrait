'use client'

import { useState } from 'react'
import {
  HistoryIcon,
  DownloadIcon,
  RefreshIcon,
  CopyIcon,
  ShuffleIcon,
  MaximizeIcon,
  GridIcon,
  FileTextIcon,
} from '@/components/icons'
import { HistoryModal } from './HistoryModal'

interface HistoryItem {
  id: string
  title?: string
  face_image_url: string
  face_image_id?: string
  reference_image_url?: string
  reference_image_id?: string
  result_urls: string[]
  params: any
  count?: number
  parallel?: boolean
  created_at: string
  is_favorite: boolean
}

interface BottomBarProps {
  prompt?: string
  onHistoryRestore?: (item: HistoryItem) => void
  onReset?: () => void
  onDownloadAll?: () => void
  onRandomSeed?: () => void
  onCopyPrompt?: () => void
  onToggleGrid?: () => void
  onShowReport?: () => void
  hasResults?: boolean
  hasPrompt?: boolean
}

export function BottomBar({
  prompt = '',
  onHistoryRestore,
  onReset,
  onDownloadAll,
  onRandomSeed,
  onCopyPrompt,
  onToggleGrid,
  onShowReport,
  hasResults = false,
  hasPrompt = false,
}: BottomBarProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyPrompt = () => {
    if (prompt && onCopyPrompt) {
      onCopyPrompt()
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="floating-prompt-bar">
          {/* Prompt Label */}
          <span className="text-xs text-[#666] mb-1.5 block">Prompt</span>

          {/* Prompt Text */}
          <div className="text-sm text-[#ccc] mb-3 max-w-lg max-h-20 overflow-y-auto">
            {prompt || 'Enter a prompt to describe your desired output...'}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-center gap-1">
            {/* History */}
            <button
              className="p-2.5 rounded-lg transition-colors text-[#888] hover:text-white hover:bg-white/5"
              onClick={() => setShowHistory(true)}
              title="History"
            >
              <HistoryIcon size={18} />
            </button>

            {/* Reset */}
            <button
              className="p-2.5 rounded-lg transition-colors text-[#888] hover:text-white hover:bg-white/5"
              onClick={onReset}
              title="Reset All"
            >
              <RefreshIcon size={18} />
            </button>

            {/* Random Seed */}
            <button
              className="p-2.5 rounded-lg transition-colors text-[#888] hover:text-white hover:bg-white/5"
              onClick={onRandomSeed}
              title="New Random Seed"
            >
              <ShuffleIcon size={18} />
            </button>

            {/* Copy Prompt */}
            <button
              className={`p-2.5 rounded-lg transition-colors ${
                hasPrompt
                  ? copied
                    ? 'text-green-400 bg-green-400/10'
                    : 'text-[#888] hover:text-white hover:bg-white/5'
                  : 'text-[#444] cursor-not-allowed'
              }`}
              onClick={hasPrompt ? handleCopyPrompt : undefined}
              title={copied ? 'Copied!' : 'Copy Prompt'}
              disabled={!hasPrompt}
            >
              <CopyIcon size={18} />
            </button>

            {/* Download All */}
            <button
              className={`p-2.5 rounded-lg transition-colors ${
                hasResults
                  ? 'text-[#888] hover:text-white hover:bg-white/5'
                  : 'text-[#444] cursor-not-allowed'
              }`}
              onClick={hasResults ? onDownloadAll : undefined}
              title="Download All Results"
              disabled={!hasResults}
            >
              <DownloadIcon size={18} />
            </button>

            {/* Report */}
            <button
              className={`p-2.5 rounded-lg transition-colors ${
                hasResults
                  ? 'text-[#888] hover:text-white hover:bg-white/5'
                  : 'text-[#444] cursor-not-allowed'
              }`}
              onClick={hasResults ? onShowReport : undefined}
              title="View Report"
              disabled={!hasResults}
            >
              <FileTextIcon size={18} />
            </button>

            {/* Toggle Grid */}
            <button
              className="p-2.5 rounded-lg transition-colors text-[#888] hover:text-white hover:bg-white/5"
              onClick={onToggleGrid}
              title="Toggle Grid"
            >
              <GridIcon size={18} />
            </button>

            {/* Fullscreen */}
            <button
              className="p-2.5 rounded-lg transition-colors text-[#888] hover:text-white hover:bg-white/5"
              onClick={handleFullscreen}
              title="Toggle Fullscreen"
            >
              <MaximizeIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={onHistoryRestore}
      />
    </>
  )
}
