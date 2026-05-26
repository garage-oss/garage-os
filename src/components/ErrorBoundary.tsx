'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw }  from 'lucide-react'
import { captureException }          from '@/lib/sentry'

interface Props {
  children:  ReactNode
  /** Custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error?:   Error
}

/**
 * Generic React error boundary.
 *
 * Wrap sections of the UI that can fail independently (e.g. widgets, forms)
 * so a crash in one section doesn't take down the whole page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeWidget />
 *   </ErrorBoundary>
 *
 *   // With custom fallback:
 *   <ErrorBoundary fallback={(err, reset) => <MyFallback error={err} onRetry={reset} />}>
 *     <SomeWidget />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? undefined })
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const error = this.state.error ?? new Error('Unknown error')

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset)
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-3 min-h-[120px]
                      bg-[#1a1d27] border border-[#2e3147] rounded-xl">
        <AlertTriangle size={28} className="text-amber-400" />
        <p className="text-sm text-[#8892a4]">משהו השתבש בטעינת הרכיב.</p>
        <button
          onClick={this.reset}
          className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#4f46e5]
                     transition-colors"
        >
          <RefreshCw size={12} />
          נסה שנית
        </button>
      </div>
    )
  }
}
