'use client'

import { useEffect, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from '@/components/icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  showCloseButton?: boolean
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  showCloseButton = true,
}: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Content */}
      <div className="modal-content animate-in">
        <div className={cn('relative', className)}>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors z-10"
            >
              <CloseIcon size={18} />
            </button>
          )}
          {children}
        </div>
      </div>
    </>
  )
}

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  title?: string
  description?: string
}

export function ImageModal({
  isOpen,
  onClose,
  imageSrc,
  title,
  description,
}: ImageModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-5xl w-full">
      {/* Liquid Glass Container */}
      <div className="image-modal-glass relative rounded-[20px] p-4">
        {/* Image with rounded corners */}
        <div className="overflow-hidden rounded-[16px]">
          <img
            src={imageSrc}
            alt={title || 'Preview'}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        </div>
      </div>
    </Modal>
  )
}
