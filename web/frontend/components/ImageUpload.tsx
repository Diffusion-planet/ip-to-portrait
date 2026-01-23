'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { UploadIcon, ImageIcon, CloseIcon } from '@/components/icons'

interface ImageUploadProps {
  onUpload: (file: File) => Promise<void>
  onClear?: () => void
  previewUrl?: string | null
  className?: string
  disabled?: boolean
  loading?: boolean
}

export function ImageUpload({
  onUpload,
  onClear,
  previewUrl,
  className,
  disabled = false,
  loading = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      await onUpload(file)
    }
  }, [disabled, onUpload])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await onUpload(file)
    }
    // Reset input
    e.target.value = ''
  }, [onUpload])

  const handleClick = useCallback(() => {
    if (!disabled && !loading) {
      fileInputRef.current?.click()
    }
  }, [disabled, loading])

  return (
    <div className={cn('relative', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {previewUrl ? (
        <div className="relative w-[300px] h-[300px] rounded-[18px] overflow-hidden border border-border bg-black">
          <img
            src={previewUrl}
            alt="Uploaded"
            className="w-full h-full object-contain"
          />
          {onClear && !disabled && (
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 rounded-[14px] bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center w-[300px] h-[300px] p-6 rounded-[18px] border-2 border-dashed transition-all cursor-pointer',
            isDragging
              ? 'border-white/30 bg-white/5'
              : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-white/5',
            disabled && 'opacity-50 cursor-not-allowed',
            loading && 'cursor-wait'
          )}
        >
          {loading ? (
            <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-[14px] bg-[rgba(255,255,255,0.05)] flex items-center justify-center mb-3">
                {isDragging ? (
                  <ImageIcon size={24} className="text-white" />
                ) : (
                  <UploadIcon size={24} className="text-[#888]" />
                )}
              </div>
              <p className="text-sm text-text-secondary text-center">
                {isDragging ? (
                  'Drop image here'
                ) : (
                  <>
                    <span className="text-white">Click to upload</span> or drag and drop
                  </>
                )}
              </p>
              <p className="text-xs text-text-muted mt-1">
                PNG, JPG, WEBP up to 10MB
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
