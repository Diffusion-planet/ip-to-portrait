'use client'

import { useRef, useCallback, useState } from 'react'
import { NodeBox, Port } from './NodeBox'
import { CloseIcon, ImageIcon } from '@/components/icons'

interface ReferenceImageNodeProps {
  id: string
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onClear?: () => void
  onDemoSelect?: () => void
  isUploading?: boolean
  onPortClick?: (portId: string, type: 'input' | 'output') => void
  selected?: boolean
  active?: boolean
}

export function ReferenceImageNode({
  id,
  imageUrl,
  onUpload,
  onClear,
  onDemoSelect,
  isUploading,
  onPortClick,
  selected,
  active,
}: ReferenceImageNodeProps) {
  const outputPorts: Port[] = [
    { id: 'reference_image', label: 'reference', color: 'yellow', type: 'output' },
  ]

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await onUpload(file)
    e.target.value = ''
  }, [onUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      await onUpload(file)
    }
  }, [onUpload])

  return (
    <NodeBox
      id={id}
      title="Reference Image"
      outputPorts={outputPorts}
      onPortClick={onPortClick}
      selected={selected}
      active={active}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="space-y-4">
        <p className="text-2xl text-[#888] font-medium">Background/template image</p>

        {imageUrl ? (
          /* Preview */
          <div className="relative w-[300px] h-[300px] rounded-[18px] overflow-hidden border border-border bg-black">
            <img
              src={imageUrl}
              alt="Uploaded"
              className="w-full h-full object-contain"
            />
            {onClear && (
              <button
                onClick={onClear}
                className="nodrag nopan absolute top-2 right-2 p-1.5 rounded-[14px] bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        ) : (
          /* Demo (main) + Upload (secondary) */
          <div className="space-y-3">
            {/* Demo - big area */}
            {onDemoSelect && (
              <div
                onClick={onDemoSelect}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`nodrag nopan relative flex flex-col items-center justify-center w-[300px] h-[260px] rounded-[18px] border-2 border-dashed transition-all cursor-pointer ${
                  isDragging
                    ? 'border-white/30 bg-white/5'
                    : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-white/[0.03]'
                }`}
              >
                {isUploading ? (
                  <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                ) : isDragging ? (
                  <>
                    <div className="w-12 h-12 rounded-[14px] bg-[rgba(255,255,255,0.05)] flex items-center justify-center mb-3">
                      <ImageIcon size={24} className="text-white" />
                    </div>
                    <p className="text-sm text-white">Drop image here</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-[16px] bg-[rgba(255,255,255,0.05)] flex items-center justify-center mb-3">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                    </div>
                    <p className="text-[15px] text-white font-medium">Demo Reference</p>
                    <p className="text-xs text-[#666] mt-1">Click to browse demo photos</p>
                  </>
                )}
              </div>
            )}

            {/* Upload - small button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="nodrag nopan w-[300px] py-2.5 rounded-[12px] text-xs font-medium text-[#888] bg-white/[0.03] border border-white/[0.06] hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              Upload your own image
            </button>
          </div>
        )}
      </div>
    </NodeBox>
  )
}
