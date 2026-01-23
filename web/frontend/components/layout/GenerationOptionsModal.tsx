'use client'

import { useState, useEffect, useRef } from 'react'
import { CloseIcon, PlayIcon, RefreshIcon } from '@/components/icons'

interface GenerationOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (options: GenerationOptions) => void
  initialOptions?: Partial<GenerationOptions>
  isGenerating?: boolean
}

export interface GenerationOptions {
  count: number
  parallel: boolean
  seed: number
}

export function GenerationOptionsModal({
  isOpen,
  onClose,
  onGenerate,
  initialOptions,
  isGenerating = false,
}: GenerationOptionsModalProps) {
  const [count, setCount] = useState(initialOptions?.count ?? 4)
  const [parallel, setParallel] = useState(initialOptions?.parallel ?? false)
  const [seed, setSeed] = useState(initialOptions?.seed ?? -1)
  const [useSeed, setUseSeed] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Update state when initialOptions change
  useEffect(() => {
    if (initialOptions) {
      setCount(initialOptions.count ?? 4)
      setParallel(initialOptions.parallel ?? false)
      setSeed(initialOptions.seed ?? -1)
      setUseSeed(initialOptions.seed !== undefined && initialOptions.seed >= 0)
    }
  }, [initialOptions])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleGenerate = () => {
    onGenerate({
      count,
      parallel,
      seed: useSeed ? seed : -1,
    })
  }

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647))
    setUseSeed(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-[#1a1a1a] rounded-[20px] border border-[rgba(255,255,255,0.1)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-base font-medium text-white">Generation Options</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-white/5 transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Count */}
          <div>
            <label className="block text-sm text-[#888] mb-2">Number of Images</label>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    count === n
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-[#242424] text-[#888] border border-transparent hover:text-white hover:bg-[#2a2a2a]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Parallel Mode */}
          <div>
            <label className="block text-sm text-[#888] mb-2">Execution Mode</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setParallel(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm transition-colors ${
                  !parallel
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-[#242424] text-[#888] border border-transparent hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <div className="font-medium">Sequential</div>
                <div className="text-[10px] text-[#666] mt-0.5">One by one</div>
              </button>
              <button
                onClick={() => setParallel(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm transition-colors ${
                  parallel
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-[#242424] text-[#888] border border-transparent hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <div className="font-medium">Parallel</div>
                <div className="text-[10px] text-[#666] mt-0.5">All at once</div>
              </button>
            </div>
          </div>

          {/* Seed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#888]">Seed</label>
              <label className="flex items-center gap-2 text-xs text-[#666]">
                <input
                  type="checkbox"
                  checked={useSeed}
                  onChange={(e) => setUseSeed(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#444] bg-[#242424] text-accent-green focus:ring-0 focus:ring-offset-0"
                />
                Use specific seed
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={useSeed ? seed : ''}
                onChange={(e) => {
                  setSeed(parseInt(e.target.value) || 0)
                  setUseSeed(true)
                }}
                placeholder="Random"
                disabled={!useSeed}
                className="flex-1 px-3 py-2 bg-[#242424] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-white placeholder-[#666] focus:outline-none focus:border-[rgba(255,255,255,0.2)] disabled:opacity-50"
              />
              <button
                onClick={randomizeSeed}
                className="p-2 rounded-lg bg-[#242424] border border-[rgba(255,255,255,0.08)] text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                title="Random seed"
              >
                <RefreshIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[#151515]">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon size={16} />
            <span className="text-sm font-medium">
              {isGenerating ? 'Generating...' : `Generate ${count} Image${count > 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
