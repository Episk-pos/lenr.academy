import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DatabaseProvider, useDatabase } from './DatabaseContext'

// Mock database service
vi.mock('../services/database', () => ({
  initDatabase: vi.fn(),
  downloadUpdate: vi.fn(),
  getCurrentVersion: vi.fn().mockReturnValue('v1.0.0'),
}))

vi.mock('../services/dbCache', () => ({
  clearAllCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../components/MeteredConnectionWarning', () => ({
  default: ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="metered-warning">
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

import { initDatabase } from '../services/database'

describe('DatabaseContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('DatabaseProvider', () => {
    it('starts in loading state', () => {
      // Make initDatabase hang to keep loading state
      vi.mocked(initDatabase).mockReturnValue(new Promise(() => {}))

      function TestComponent() {
        const { isLoading, db } = useDatabase()
        return (
          <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="db">{db ? 'loaded' : 'null'}</span>
          </div>
        )
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      expect(screen.getByTestId('loading').textContent).toBe('true')
      expect(screen.getByTestId('db').textContent).toBe('null')
    })

    it('provides database after successful initialization', async () => {
      const mockDb = { exec: vi.fn(), close: vi.fn() }
      vi.mocked(initDatabase).mockResolvedValue(mockDb as any)

      function TestComponent() {
        const { isLoading, db, error } = useDatabase()
        return (
          <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="db">{db ? 'loaded' : 'null'}</span>
            <span data-testid="error">{error ? error.message : 'none'}</span>
          </div>
        )
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      expect(screen.getByTestId('db').textContent).toBe('loaded')
      expect(screen.getByTestId('error').textContent).toBe('none')
    })

    it('provides error on initialization failure', async () => {
      vi.mocked(initDatabase).mockRejectedValue(new Error('Failed to load'))

      function TestComponent() {
        const { isLoading, error } = useDatabase()
        return (
          <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="error">{error ? error.message : 'none'}</span>
          </div>
        )
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Failed to load')
      })

      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    it('provides version info after load', async () => {
      const mockDb = { exec: vi.fn(), close: vi.fn() }
      vi.mocked(initDatabase).mockResolvedValue(mockDb as any)

      function TestComponent() {
        const { currentVersion } = useDatabase()
        return <span data-testid="version">{currentVersion || 'none'}</span>
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('version').textContent).toBe('v1.0.0')
      })
    })

    it('detects update availability via callback', async () => {
      const mockDb = { exec: vi.fn(), close: vi.fn() }
      vi.mocked(initDatabase).mockImplementation(async (_onProgress, onUpdateAvailable) => {
        if (onUpdateAvailable) {
          onUpdateAvailable('v2.0.0')
        }
        return mockDb as any
      })

      function TestComponent() {
        const { isUpdateAvailable, availableVersion } = useDatabase()
        return (
          <div>
            <span data-testid="update-available">{String(isUpdateAvailable)}</span>
            <span data-testid="available-version">{availableVersion || 'none'}</span>
          </div>
        )
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('update-available').textContent).toBe('true')
      })

      expect(screen.getByTestId('available-version').textContent).toBe('v2.0.0')
    })

    it('wraps non-Error exceptions in Error objects', async () => {
      vi.mocked(initDatabase).mockRejectedValue('string error')

      function TestComponent() {
        const { error } = useDatabase()
        return <span data-testid="error">{error ? error.message : 'none'}</span>
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Failed to initialize database')
      })
    })
  })

  describe('useDatabase', () => {
    it('provides default context values', () => {
      // useDatabase should not throw when used within provider
      const mockDb = { exec: vi.fn(), close: vi.fn() }
      vi.mocked(initDatabase).mockResolvedValue(mockDb as any)

      function TestComponent() {
        const context = useDatabase()
        return (
          <div>
            <span data-testid="has-start">{typeof context.startBackgroundUpdate}</span>
            <span data-testid="has-reload">{typeof context.reloadWithNewVersion}</span>
            <span data-testid="has-clear">{typeof context.clearDatabaseCache}</span>
          </div>
        )
      }

      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>
      )

      expect(screen.getByTestId('has-start').textContent).toBe('function')
      expect(screen.getByTestId('has-reload').textContent).toBe('function')
      expect(screen.getByTestId('has-clear').textContent).toBe('function')
    })
  })
})
