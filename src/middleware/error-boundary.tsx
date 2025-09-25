'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logError } from '@/src/lib/utils/error-handling'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'feature'
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
}

interface ErrorDisplayProps {
  error: Error
  errorInfo: ErrorInfo | null
  errorId: string
  level: string
  onRetry: () => void
  onReportIssue: () => void
  retryCount: number
  maxRetries: number
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  errorId,
  level,
  onRetry,
  onReportIssue,
  retryCount,
  maxRetries
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-[200px] flex items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="max-w-md text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Something went wrong
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          {level === 'page'
            ? 'This page encountered an error and cannot be displayed.'
            : level === 'feature'
            ? 'This feature is temporarily unavailable due to an error.'
            : 'A component on this page has encountered an error.'
          }
        </p>

        {isDevelopment && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Error Details (Development)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-32">
              <div className="font-semibold text-red-600 mb-1">
                {error.name}: {error.message}
              </div>
              {error.stack && (
                <div className="whitespace-pre-wrap text-gray-600">
                  {error.stack}
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {retryCount < maxRetries && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again {retryCount > 0 && `(${retryCount}/${maxRetries})`}
            </button>
          )}

          <button
            onClick={onReportIssue}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Report Issue
          </button>
        </div>

        {errorId && (
          <p className="mt-3 text-xs text-gray-500">
            Error ID: {errorId}
          </p>
        )}
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null
  private maxRetries = 3
  private retryDelay = 1000 // 1 second

  constructor(props: Props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to our error handling system
    const errorId = this.state.errorId || `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logError(error, {
      errorBoundary: true,
      level: this.props.level || 'component',
      errorId,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    })

    this.setState({
      errorInfo,
      errorId
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Auto-retry for certain types of errors
    if (this.shouldAutoRetry(error) && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry()
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys = [], resetOnPropsChange = false } = this.props
    const { hasError } = this.state

    // Reset error boundary if resetKeys changed
    if (hasError && resetKeys.length > 0) {
      const prevResetKeys = prevProps.resetKeys || []
      const hasResetKeyChanged = resetKeys.some((key, idx) => prevResetKeys[idx] !== key)

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }

    // Reset on any props change if enabled
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
    }
  }

  private shouldAutoRetry(error: Error): boolean {
    // Don't auto-retry for certain error types
    const noRetryErrors = [
      'ChunkLoadError',
      'TypeError',
      'ReferenceError',
      'SyntaxError'
    ]

    return !noRetryErrors.some(errorType =>
      error.name.includes(errorType) ||
      error.message.includes(errorType)
    )
  }

  private scheduleRetry = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
    }

    this.resetTimeoutId = window.setTimeout(() => {
      this.retryRender()
    }, this.retryDelay)
  }

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    })
  }

  private retryRender = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  private handleReportIssue = () => {
    const { error, errorInfo, errorId } = this.state

    if (!error || !errorId) return

    // Create issue report data
    const report = {
      errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      level: this.props.level || 'component'
    }

    // Log detailed report
    console.error('🚨 User reported error:', report)

    // In a real app, you might send this to an error reporting service
    // or open a support ticket system
    alert('Error report generated. Please check the console for details.')
  }

  render() {
    const { hasError, error, errorInfo, errorId, retryCount } = this.state
    const { children, fallback, level = 'component' } = this.props

    if (hasError && error) {
      // Custom fallback component
      if (fallback) {
        return fallback
      }

      // Default error display
      return (
        <ErrorDisplay
          error={error}
          errorInfo={errorInfo}
          errorId={errorId || 'unknown'}
          level={level}
          onRetry={this.retryRender}
          onReportIssue={this.handleReportIssue}
          retryCount={retryCount}
          maxRetries={this.maxRetries}
        />
      )
    }

    return children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for triggering error boundary from child components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const triggerError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return {
    triggerError,
    resetError,
    hasError: error !== null
  }
}

export default ErrorBoundary