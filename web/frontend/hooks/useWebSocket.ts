'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  data?: any
  batch_id?: string
}

interface UseWebSocketOptions {
  clientId: string
  onProgress?: (data: any) => void
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket({
  clientId,
  onProgress,
  onMessage,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const isConnectingRef = useRef(false)

  // Use refs for callbacks to avoid dependency issues
  const onProgressRef = useRef(onProgress)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  // Update refs when callbacks change
  useEffect(() => {
    onProgressRef.current = onProgress
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onProgress, onMessage, onConnect, onDisconnect])

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING ||
        isConnectingRef.current) {
      return
    }

    isConnectingRef.current = true

    const ws = new WebSocket(`ws://localhost:8008/ws/${clientId}`)

    ws.onopen = () => {
      isConnectingRef.current = false
      setIsConnected(true)
      setError(null)
      onConnectRef.current?.()
    }

    ws.onclose = () => {
      isConnectingRef.current = false
      setIsConnected(false)
      wsRef.current = null
      onDisconnectRef.current?.()

      // Attempt to reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }

    ws.onerror = () => {
      isConnectingRef.current = false
      setError('WebSocket connection error')
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        onMessageRef.current?.(message)

        if (message.type === 'progress' && message.data) {
          onProgressRef.current?.(message.data)
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    wsRef.current = ws
  }, [clientId])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (wsRef.current) {
      wsRef.current.onclose = null // Prevent reconnect on intentional close
      wsRef.current.close()
      wsRef.current = null
    }
    isConnectingRef.current = false
    setIsConnected(false)
  }, [])

  const subscribe = useCallback((batchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        batch_id: batchId,
      }))
    }
  }, [])

  const unsubscribe = useCallback((batchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        batch_id: batchId,
      }))
    }
  }, [])

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    send,
    reconnect: connect,
  }
}
