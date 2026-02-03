'use client'

import { useState, useCallback } from 'react'

const API_BASE = 'http://localhost:8008/api'

// Auth helper
const getAuthToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  includeAuth?: boolean
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(async <T>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const { method = 'GET', body, headers = {}, includeAuth = false } = options

      // Add auth header if requested and token exists
      const authHeaders: Record<string, string> = {}
      if (includeAuth) {
        const token = getAuthToken()
        if (token) {
          authHeaders['Authorization'] = `Bearer ${token}`
        }
      }

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...headers,
        },
      }

      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body)
      }

      const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      return data as T
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Upload file
  const uploadFile = useCallback(async (
    endpoint: string,
    file: File
  ): Promise<any> => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    request,
    uploadFile,
  }
}

// Typed API hooks
export function useGeneration() {
  const { request, loading, error } = useApi()

  const startGeneration = useCallback(async (params: {
    reference_image_id: string
    face_image_id: string
    params?: any
    count?: number
    parallel?: boolean
    title?: string
    client_id?: string  // WebSocket client ID for auto-subscribe
  }) => {
    return request('/generation/start', {
      method: 'POST',
      body: params,
      includeAuth: true, // Include auth token if available
    })
  }, [request])

  const getStatus = useCallback(async (batchId: string) => {
    return request(`/generation/status/${batchId}`)
  }, [request])

  const cancelBatch = useCallback(async (batchId: string) => {
    return request(`/generation/cancel/${batchId}`, { method: 'POST' })
  }, [request])

  return {
    startGeneration,
    getStatus,
    cancelBatch,
    loading,
    error,
  }
}

export function useUpload() {
  const { uploadFile, loading, error } = useApi()

  const uploadImage = useCallback(async (file: File) => {
    return uploadFile('/upload/image', file)
  }, [uploadFile])

  return {
    uploadImage,
    loading,
    error,
  }
}

export function useHistory() {
  const { request, loading, error } = useApi()

  const getHistory = useCallback(async (options?: {
    limit?: number
    offset?: number
    favorites_only?: boolean
  }) => {
    const params = new URLSearchParams()
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    if (options?.favorites_only) params.set('favorites_only', 'true')

    return request(`/history?${params.toString()}`)
  }, [request])

  const toggleFavorite = useCallback(async (itemId: string) => {
    return request(`/history/${itemId}/favorite`, { method: 'POST' })
  }, [request])

  const deleteItem = useCallback(async (itemId: string) => {
    return request(`/history/${itemId}`, { method: 'DELETE' })
  }, [request])

  const updateTitle = useCallback(async (itemId: string, title: string) => {
    return request(`/history/${itemId}/title?title=${encodeURIComponent(title)}`, {
      method: 'PATCH',
      includeAuth: true,
    })
  }, [request])

  return {
    getHistory,
    toggleFavorite,
    deleteItem,
    updateTitle,
    loading,
    error,
  }
}

export function useSettings() {
  const { request, loading, error } = useApi()

  const getSettings = useCallback(async () => {
    return request('/settings')
  }, [request])

  const updateSettings = useCallback(async (settings: any) => {
    return request('/settings', { method: 'PUT', body: settings })
  }, [request])

  const resetSettings = useCallback(async () => {
    return request('/settings/reset', { method: 'POST' })
  }, [request])

  return {
    getSettings,
    updateSettings,
    resetSettings,
    loading,
    error,
  }
}
