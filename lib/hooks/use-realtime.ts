'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface SSEEvent {
  type: 'email_processing_started' | 'email_processing_completed' | 'email_updated' | 'sync_status' | 'error'
  data: any
  id?: string
}

export interface RealtimeOptions {
  onEmailProcessingStarted?: (data: any) => void
  onEmailProcessingCompleted?: (data: any) => void
  onEmailUpdated?: (data: any) => void
  onSyncStatus?: (data: any) => void
  onError?: (data: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

export function useRealtime(options: RealtimeOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectCount, setReconnectCount] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isManuallyDisconnected = useRef(false)

  const {
    onEmailProcessingStarted,
    onEmailProcessingCompleted,
    onEmailUpdated,
    onSyncStatus,
    onError,
    onConnect,
    onDisconnect,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5
  } = options

  const disconnect = useCallback(() => {
    isManuallyDisconnected.current = true

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setConnected(false)
    setConnecting(false)
    setError(null)
    setReconnectCount(0)

    onDisconnect?.()
  }, [onDisconnect])

  const connect = useCallback(() => {
    if (eventSourceRef.current || isManuallyDisconnected.current) {
      return
    }

    setConnecting(true)
    setError(null)

    try {
      const eventSource = new EventSource('/api/realtime')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('SSE connection established')
        setConnected(true)
        setConnecting(false)
        setError(null)
        setReconnectCount(0)
        onConnect?.()
      }

      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event)
        setConnected(false)
        setConnecting(false)
        setError('Connection failed')

        // Attempt reconnection if not manually disconnected
        if (!isManuallyDisconnected.current && reconnectCount < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectCount + 1}/${maxReconnectAttempts})...`)
            setReconnectCount(prev => prev + 1)

            if (eventSourceRef.current) {
              eventSourceRef.current.close()
              eventSourceRef.current = null
            }

            connect()
          }, reconnectDelay * Math.pow(2, reconnectCount)) // Exponential backoff
        } else if (reconnectCount >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached')
          setError('Connection failed after multiple attempts')
          onError?.({ message: 'Max reconnection attempts reached' })
        }
      }

      // Handle specific event types
      eventSource.addEventListener('email_processing_started', (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Email processing started:', data)
          onEmailProcessingStarted?.(data)
        } catch (error) {
          console.error('Error parsing email_processing_started event:', error)
        }
      })

      eventSource.addEventListener('email_processing_completed', (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Email processing completed:', data)
          onEmailProcessingCompleted?.(data)
        } catch (error) {
          console.error('Error parsing email_processing_completed event:', error)
        }
      })

      eventSource.addEventListener('email_updated', (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Email updated:', data)
          onEmailUpdated?.(data)
        } catch (error) {
          console.error('Error parsing email_updated event:', error)
        }
      })

      eventSource.addEventListener('sync_status', (event) => {
        try {
          const data = JSON.parse(event.data)
          // Filter out ping messages from logging
          if (!data.ping) {
            console.log('Sync status:', data)
          }
          onSyncStatus?.(data)
        } catch (error) {
          console.error('Error parsing sync_status event:', error)
        }
      })

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data)
          console.error('SSE error event:', data)
          onError?.(data)
        } catch (error) {
          console.error('Error parsing error event:', error)
        }
      })

    } catch (error) {
      console.error('Failed to create EventSource:', error)
      setConnecting(false)
      setError('Failed to establish connection')
    }
  }, [
    onEmailProcessingStarted,
    onEmailProcessingCompleted,
    onEmailUpdated,
    onSyncStatus,
    onError,
    onConnect,
    reconnectDelay,
    maxReconnectAttempts,
    reconnectCount
  ])

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    isManuallyDisconnected.current = false
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    connected,
    connecting,
    error,
    reconnectCount,
    connect,
    disconnect,
    retry: () => {
      setReconnectCount(0)
      connect()
    }
  }
}