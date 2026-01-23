'use client'

import { useState, useEffect, useRef } from 'react'
import { CloseIcon, TrashIcon, RefreshIcon, EditIcon } from '@/components/icons'

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

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onRestore?: (item: HistoryItem, index?: number) => void
}

const LOCAL_HISTORY_KEY = 'fastface_history'

function getLocalHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(LOCAL_HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveLocalHistory(history: HistoryItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history))
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function isLoggedIn(): boolean {
  return !!getAuthToken()
}

export function HistoryModal({ isOpen, onClose, onRestore }: HistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      if (isLoggedIn()) {
        // Fetch from API for logged-in users
        const token = getAuthToken()
        const response = await fetch('http://localhost:8008/api/history/?limit=20', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setHistory(data)
        } else if (response.status === 401) {
          // Token expired, fall back to local
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setHistory(getLocalHistory())
        }
      } else {
        // Use localStorage for non-logged users
        setHistory(getLocalHistory())
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
      // Fall back to local history on error
      setHistory(getLocalHistory())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  const deleteItem = async (id: string) => {
    try {
      if (isLoggedIn()) {
        const token = getAuthToken()
        const response = await fetch(`http://localhost:8008/api/history/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (response.ok) {
          setHistory((prev) => prev.filter((item) => item.id !== id))
        }
      } else {
        // Delete from localStorage
        const updated = history.filter((item) => item.id !== id)
        saveLocalHistory(updated)
        setHistory(updated)
      }
    } catch (error) {
      console.error('Failed to delete history item:', error)
    }
  }

  const startEditing = (item: HistoryItem) => {
    setEditingId(item.id)
    setEditingTitle(item.title || '')
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const saveTitle = async (id: string) => {
    try {
      if (isLoggedIn()) {
        const token = getAuthToken()
        const response = await fetch(
          `http://localhost:8008/api/history/${id}/title?title=${encodeURIComponent(editingTitle)}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        )
        if (response.ok) {
          setHistory((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, title: editingTitle } : item
            )
          )
        }
      } else {
        // Update localStorage
        const updated = history.map((item) =>
          item.id === id ? { ...item, title: editingTitle } : item
        )
        saveLocalHistory(updated)
        setHistory(updated)
      }
    } catch (error) {
      console.error('Failed to update title:', error)
    } finally {
      setEditingId(null)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveTitle(id)
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-32">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Liquid Glass Effect */}
      <div className="history-modal-glass relative w-full max-w-4xl max-h-[600px] rounded-[24px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-end px-4 py-3 flex-shrink-0">
          {!isLoggedIn() && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-[rgba(255,255,255,0.1)] text-[#888] mr-auto">
              Local Only
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); fetchHistory(); }}
            className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshIcon size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
            title="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[#888]">Loading...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-[#888]">No generation history yet</p>
                <p className="text-xs text-[#666] mt-2">
                  {isLoggedIn()
                    ? 'Your generated images will appear here'
                    : 'Sign in to sync history across devices'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {history.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-[#242424] rounded-[18px] border border-[rgba(255,255,255,0.05)] p-4 hover:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer"
                  onClick={() => {
                    onRestore?.(item, index)
                    onClose()
                  }}
                >
                  <div className="flex gap-4">
                    {/* Images */}
                    <div className="flex gap-2">
                      {/* Face Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)]">
                        <img
                          src={`http://localhost:8008${item.face_image_url}`}
                          alt="Face"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Reference Image */}
                      {item.reference_image_url && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)]">
                          <img
                            src={`http://localhost:8008${item.reference_image_url}`}
                            alt="Reference"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Arrow */}
                      <div className="flex items-center px-2 text-[#666]">→</div>

                      {/* Result Images */}
                      <div className="flex gap-2">
                        {item.result_urls.slice(0, 4).map((url, idx) => (
                          <div
                            key={idx}
                            className="w-20 h-20 rounded-lg overflow-hidden bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)]"
                          >
                            <img
                              src={`http://localhost:8008${url}`}
                              alt={`Result ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {item.result_urls.length > 4 && (
                          <div className="w-20 h-20 rounded-lg bg-[#2a2a2a] border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#666] text-xs">
                            +{item.result_urls.length - 4}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        {editingId === item.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => saveTitle(item.id)}
                            onKeyDown={(e) => handleTitleKeyDown(e, item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm text-white font-medium bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-white/40"
                            placeholder="Enter title..."
                          />
                        ) : (
                          <div className="flex items-center gap-2 group/title">
                            <p className="text-sm text-white font-medium truncate">
                              {item.title || new Date(item.created_at).toLocaleString()}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditing(item)
                              }}
                              className="p-1 rounded text-[#666] hover:text-white opacity-0 group-hover/title:opacity-100 transition-opacity"
                              title="Edit title"
                            >
                              <EditIcon size={12} />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-[#666] mt-1">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-[#888] mt-1 truncate">
                          {item.params.prompt || 'No prompt'}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs text-[#666]">
                        <span>Steps: {item.params.actual_steps || item.params.steps}</span>
                        <span>•</span>
                        <span>CFG: {item.params.guidance_scale}</span>
                        {item.count && <><span>•</span><span>Count: {item.count}</span></>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteItem(item.id)
                        }}
                        className="p-2 rounded-lg text-[#666] hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Export utility functions for use by generation service
export { getLocalHistory, saveLocalHistory, getAuthToken, isLoggedIn, LOCAL_HISTORY_KEY }
