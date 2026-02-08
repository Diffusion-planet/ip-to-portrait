'use client'

import { useState, useEffect, useCallback } from 'react'
import { CloseIcon } from '@/components/icons'

interface DemoReferenceSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: File) => void
}

interface DemoImage {
  url: string
  gender: 'man' | 'woman' | 'other'
}

type GenderFilter = 'all' | 'man' | 'woman' | 'special'

const CARD_WIDTH = 130
const CARD_HEIGHT = 170
const GAP = 16
const STRIDE = CARD_WIDTH + GAP
const CENTER_SCALE = 1.35

export function DemoReferenceSelector({ isOpen, onClose, onSelect }: DemoReferenceSelectorProps) {
  const [allImages, setAllImages] = useState<DemoImage[]>([])
  const [filter, setFilter] = useState<GenderFilter>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const filteredImages = filter === 'all'
    ? allImages
    : filter === 'special'
    ? allImages.filter((img) => img.gender === 'other')
    : allImages.filter((img) => img.gender === filter)

  // Fetch demo images
  useEffect(() => {
    if (!isOpen) return
    fetch('/api/demo-images')
      .then((res) => res.json())
      .then((data) => {
        setAllImages(data.images || [])
        setSelectedIndex(0)
        setFilter('all')
      })
      .catch(() => setAllImages([]))
  }, [isOpen])

  // Reset index when filter changes
  const handleFilterChange = useCallback((newFilter: GenderFilter) => {
    setFilter(newFilter)
    setSelectedIndex(0)
  }, [])

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || filteredImages.length === 0) return
      const clamped = Math.max(0, Math.min(index, filteredImages.length - 1))
      if (clamped === selectedIndex) return
      setIsTransitioning(true)
      setSelectedIndex(clamped)
      setTimeout(() => setIsTransitioning(false), 300)
    },
    [selectedIndex, filteredImages.length, isTransitioning]
  )

  const goLeft = useCallback(() => goTo(selectedIndex - 1), [goTo, selectedIndex])
  const goRight = useCallback(() => goTo(selectedIndex + 1), [goTo, selectedIndex])

  const handleConfirm = useCallback(async () => {
    if (filteredImages.length === 0) return
    const imageUrl = filteredImages[selectedIndex]?.url
    if (!imageUrl) return
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const filename = imageUrl.split('/').pop() || 'demo.jpg'
      const file = new File([blob], filename, { type: blob.type })
      onSelect(file)
      onClose()
    } catch (err) {
      console.error('Failed to load demo image:', err)
    }
  }, [filteredImages, selectedIndex, onSelect, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goLeft()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goRight()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goLeft, goRight, onClose, handleConfirm])

  if (!isOpen) return null

  const manCount = allImages.filter((img) => img.gender === 'man').length
  const womanCount = allImages.filter((img) => img.gender === 'woman').length
  const specialCount = allImages.filter((img) => img.gender === 'other').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="demo-selector-glass relative w-full max-w-5xl rounded-[24px] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
          <h2 className="text-[15px] font-medium text-white/80">Demo Reference</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Gender Filter Tabs */}
        <div className="flex items-center gap-1 px-6 pb-3">
          <div className="flex items-center gap-1 p-1 rounded-[12px] bg-white/[0.04] border border-white/[0.06]">
            {([
              { key: 'all' as GenderFilter, label: 'All', count: allImages.length },
              { key: 'man' as GenderFilter, label: 'Male', count: manCount },
              { key: 'woman' as GenderFilter, label: 'Female', count: womanCount },
              ...(specialCount > 0 ? [{ key: 'special' as GenderFilter, label: 'Special', count: specialCount }] : []),
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`px-4 py-1.5 rounded-[10px] text-xs font-medium transition-all ${
                  filter === key
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-[#888] hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {label}
                <span className={`ml-1.5 ${filter === key ? 'text-white/50' : 'text-[#555]'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carousel */}
        <div className="relative px-6 pb-6">
          {filteredImages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-[#888] text-sm">No images</p>
            </div>
          ) : (
            <>
              {/* Navigation arrows */}
              {selectedIndex > 0 && (
                <button
                  onClick={goLeft}
                  className="absolute left-3 top-[calc(50%-20px)] z-10 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              {selectedIndex < filteredImages.length - 1 && (
                <button
                  onClick={goRight}
                  className="absolute right-3 top-[calc(50%-20px)] z-10 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}

              {/* Image track container */}
              <div
                className="overflow-hidden"
                style={{ height: `${CARD_HEIGHT * CENTER_SCALE + 40}px` }}
              >
                <div
                  className="flex items-center transition-transform duration-300 ease-out"
                  style={{
                    gap: `${GAP}px`,
                    paddingTop: `${(CARD_HEIGHT * CENTER_SCALE - CARD_HEIGHT) / 2 + 20}px`,
                    transform: `translateX(calc(50% - ${selectedIndex * STRIDE + CARD_WIDTH / 2}px))`,
                  }}
                >
                  {filteredImages.map((img, i) => {
                    const distance = Math.abs(i - selectedIndex)
                    const isCenter = i === selectedIndex

                    const scale = isCenter
                      ? CENTER_SCALE
                      : Math.max(0.75, 1 - distance * 0.08)

                    const opacity = isCenter
                      ? 1
                      : Math.max(0.2, 0.7 - distance * 0.12)

                    return (
                      <div
                        key={img.url}
                        onClick={() => {
                          if (isCenter) {
                            handleConfirm()
                          } else {
                            goTo(i)
                          }
                        }}
                        className="flex-shrink-0 cursor-pointer transition-all duration-300 ease-out origin-center"
                        style={{
                          width: `${CARD_WIDTH}px`,
                          height: `${CARD_HEIGHT}px`,
                          transform: `scale(${scale})`,
                          opacity,
                          zIndex: isCenter ? 10 : 5 - distance,
                        }}
                      >
                        <div
                          className={`w-full h-full rounded-[14px] overflow-hidden border transition-all duration-300 ${
                            isCenter
                              ? 'border-white/25 shadow-[0_4px_24px_rgba(255,255,255,0.08)]'
                              : 'border-white/8 hover:border-white/15'
                          }`}
                          style={{ background: '#1a1a1a' }}
                        >
                          <img
                            src={img.url}
                            alt={`Demo ${i + 1}`}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Counter + Select */}
              <div className="flex items-center justify-center gap-4 pt-2 pb-1">
                <span className="text-xs text-[#666]">
                  {selectedIndex + 1} / {filteredImages.length}
                </span>
              </div>
              <div className="flex justify-center pb-2">
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2.5 rounded-[14px] text-sm font-medium bg-white/10 border border-white/15 text-white hover:bg-white/15 hover:border-white/25 transition-all"
                >
                  Select
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
