'use client'

import { useState, useEffect } from 'react'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { AlertCircle, CheckCircle, Clock, Loader2, Wifi, WifiOff } from 'lucide-react'

interface ProcessingStats {
  scored: number
  summarized: number
  errors: number
}

interface Performance {
  totalProcessingTime: number
  avgTimePerEmail: number
  systemHealth: string
}

export function ProcessingStatus() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastProcessed, setLastProcessed] = useState<ProcessingStats | null>(null)
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [message, setMessage] = useState<string>('')
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null)

  const {
    connected,
    connecting,
    error,
    reconnectCount
  } = useRealtime({
    onEmailProcessingStarted: (data) => {
      console.log('Processing started event received:', data)
      setIsProcessing(true)
      setMessage(data.message || 'Processing emails...')
      setProcessingStartTime(new Date(data.timestamp))
      setLastProcessed(null)
      setPerformance(null)
    },
    onEmailProcessingCompleted: (data) => {
      console.log('Processing completed event received:', data)
      setIsProcessing(false)
      setMessage(data.message || 'Processing completed')
      setLastProcessed(data.processed)
      setPerformance(data.performance)
      setProcessingStartTime(null)

      // Clear the completion message after 5 seconds
      setTimeout(() => {
        setMessage('')
        setLastProcessed(null)
        setPerformance(null)
      }, 5000)
    },
    onSyncStatus: (data) => {
      // Handle sync status if needed (ping messages, etc.)
      if (!data.ping && data.message && data.message !== 'Connected to real-time updates') {
        console.log('Sync status:', data)
      }
    },
    onError: (data) => {
      console.error('SSE error:', data)
      setIsProcessing(false)
      setMessage(`Error: ${data.message || 'Unknown error occurred'}`)

      // Clear error message after 10 seconds
      setTimeout(() => {
        setMessage('')
      }, 10000)
    },
    onConnect: () => {
      console.log('SSE connected')
    },
    onDisconnect: () => {
      console.log('SSE disconnected')
    }
  })

  // Calculate processing duration
  const [processingDuration, setProcessingDuration] = useState<number>(0)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isProcessing && processingStartTime) {
      interval = setInterval(() => {
        const now = new Date()
        const duration = Math.floor((now.getTime() - processingStartTime.getTime()) / 1000)
        setProcessingDuration(duration)
      }, 1000)
    } else {
      setProcessingDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isProcessing, processingStartTime])

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getConnectionIcon = () => {
    if (connecting) {
      return <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
    }
    if (connected) {
      return <Wifi className="h-3 w-3 text-green-500" />
    }
    if (error) {
      return <WifiOff className="h-3 w-3 text-red-500" />
    }
    return <WifiOff className="h-3 w-3 text-gray-400" />
  }

  const getConnectionStatus = () => {
    if (connecting) return 'Connecting...'
    if (connected) return 'Connected'
    if (error) return `Connection failed${reconnectCount > 0 ? ` (attempt ${reconnectCount})` : ''}`
    return 'Disconnected'
  }

  // Don't render anything if there's nothing to show
  if (!isProcessing && !message && !lastProcessed && connected && !error) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {getConnectionIcon()}
        <span>Real-time updates enabled</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">Email Processing Status</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {getConnectionIcon()}
          <span>{getConnectionStatus()}</span>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">{message}</p>
            {processingDuration > 0 && (
              <p className="text-xs text-blue-700 mt-1">
                Processing time: {formatDuration(processingDuration)}
              </p>
            )}
          </div>
        </div>
      )}

      {!isProcessing && lastProcessed && (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">{message}</p>
            <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-medium text-green-800">Scored</p>
                <p className="text-green-700">{lastProcessed.scored}</p>
              </div>
              <div>
                <p className="font-medium text-green-800">Summarized</p>
                <p className="text-green-700">{lastProcessed.summarized}</p>
              </div>
              <div>
                <p className="font-medium text-green-800">Errors</p>
                <p className="text-green-700">{lastProcessed.errors}</p>
              </div>
            </div>
            {performance && (
              <div className="mt-2 text-xs text-green-700">
                <p>Processing time: {(performance.totalProcessingTime / 1000).toFixed(1)}s</p>
                <p>System health: {performance.systemHealth}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isProcessing && message && !lastProcessed && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{message}</p>
          </div>
        </div>
      )}

      {error && !isProcessing && (
        <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
          {reconnectCount > 0 && (
            <span className="ml-2 text-gray-500">
              (Reconnection attempts: {reconnectCount})
            </span>
          )}
        </div>
      )}
    </div>
  )
}