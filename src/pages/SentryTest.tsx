import * as Sentry from '@sentry/react'
import { useState } from 'react'

function SentryTest() {
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testError = () => {
    try {
      addResult('Throwing test error...')
      throw new Error('Test error from Sentry Test page')
    } catch (error) {
      Sentry.captureException(error)
      addResult('✅ Error captured and sent to Sentry')
    }
  }

  const testUncaughtError = () => {
    addResult('Throwing uncaught error (will trigger ErrorBoundary)...')
    // This will be caught by the ErrorBoundary
    throw new Error('Uncaught test error - this should trigger the ErrorBoundary')
  }

  const testSpan = () => {
    addResult('Creating performance span...')
    Sentry.startSpan(
      {
        op: 'test.operation',
        name: 'Sentry Test Button Click',
      },
      (span) => {
        span.setAttribute('test_type', 'manual')
        span.setAttribute('user_action', 'button_click')

        // Simulate some work
        const start = Date.now()
        let _sum = 0
        for (let i = 0; i < 1000000; i++) {
          _sum += i
        }
        const duration = Date.now() - start

        span.setAttribute('computation_duration_ms', duration)
        addResult(`✅ Performance span created (${duration}ms computation)`)
      }
    )
  }

  const testMessage = () => {
    addResult('Sending test message...')
    Sentry.captureMessage('Test message from Sentry Test page', 'info')
    addResult('✅ Message sent to Sentry')
  }

  const testWithContext = () => {
    addResult('Sending error with custom context...')
    Sentry.captureException(new Error('Test error with context'), {
      tags: {
        test_type: 'manual',
        feature: 'sentry_test_page',
      },
      contexts: {
        test_info: {
          timestamp: new Date().toISOString(),
          page: 'SentryTest',
          user_triggered: true,
        },
      },
      level: 'warning',
    })
    addResult('✅ Error with context sent to Sentry')
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Sentry Testing Page
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Test Sentry error tracking and performance monitoring
        </p>

        {/* Configuration Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Configuration Status
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-800 dark:text-blue-300">Sentry DSN:</span>
              <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
                {import.meta.env.VITE_SENTRY_DSN ? '✓ Configured' : '✗ Not configured'}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-800 dark:text-blue-300">Environment:</span>
              <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
                {import.meta.env.MODE}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-800 dark:text-blue-300">Version:</span>
              <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
                {import.meta.env.VITE_APP_VERSION}
              </code>
            </div>
          </div>
        </div>

        {/* Warning */}
        {import.meta.env.MODE === 'development' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
              ⚠️ Development Mode
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Sentry is configured to NOT send events in development mode. Events will only be logged to the console.
              Build and run with <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">npm run build && npm run serve</code> to test actual Sentry reporting.
            </p>
          </div>
        )}

        {/* Test Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={testError}
            className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Test Error Capture
          </button>

          <button
            onClick={testUncaughtError}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Test Uncaught Error (ErrorBoundary)
          </button>

          <button
            onClick={testSpan}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Test Performance Span
          </button>

          <button
            onClick={testMessage}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Test Message
          </button>

          <button
            onClick={testWithContext}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Test Error with Context
          </button>

          <button
            onClick={clearResults}
            className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Clear Results
          </button>
        </div>

        {/* Results */}
        {testResults.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Test Results
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-700"
                >
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            How to Verify
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Development Mode:</strong> Open browser console and click test buttons.
              You'll see Sentry events logged to console (not sent to server).
            </li>
            <li>
              <strong>Production Mode:</strong> Build with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run build</code>,
              serve with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run serve</code>, then click test buttons.
            </li>
            <li>
              <strong>Check Sentry Dashboard:</strong> Visit{' '}
              <a
                href="https://sentry.io/organizations/episkpos/issues/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                sentry.io/organizations/episkpos/issues/
              </a>
              {' '}to see captured errors.
            </li>
            <li>
              Events should appear in Sentry within a few seconds with full stack traces and context.
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default SentryTest
