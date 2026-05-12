import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkForUpdate, startVersionPolling } from './versionCheck'

/**
 * Create a mock fetch that returns the given JSON body
 */
function mockFetch(body: Record<string, unknown>, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

/**
 * Create a mock fetch that rejects with an error
 */
function mockFetchError(message: string): typeof fetch {
  return vi.fn().mockRejectedValue(new Error(message))
}

describe('checkForUpdate', () => {
  it('detects an update when versions differ', async () => {
    const fetch = mockFetch({ version: 'v2.0.0', buildTime: '2026-01-01T00:00:00Z' })
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(true)
    expect(result.version).toBe('v2.0.0')
    expect(result.buildTime).toBe('2026-01-01T00:00:00Z')
    expect(result.error).toBeUndefined()
  })

  it('reports no update when versions match', async () => {
    const fetch = mockFetch({ version: 'v1.0.0', buildTime: '2026-01-01T00:00:00Z' })
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.version).toBe('v1.0.0')
  })

  it('handles HTTP error responses gracefully', async () => {
    const fetch = mockFetch({}, 500)
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toContain('500')
  })

  it('handles network errors gracefully', async () => {
    const fetch = mockFetchError('Network failure')
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('Network failure')
  })

  it('handles null version in response', async () => {
    const fetch = mockFetch({ version: null, buildTime: null })
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.version).toBeNull()
  })

  it('handles missing fields in response', async () => {
    const fetch = mockFetch({})
    const result = await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.version).toBeNull()
    expect(result.buildTime).toBeNull()
  })

  it('sends cache-busting headers', async () => {
    const fetch = mockFetch({ version: 'v1.0.0' })
    await checkForUpdate({ currentVersion: 'v1.0.0', fetchImpl: fetch })

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cache: 'no-cache',
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache',
        }),
      })
    )
  })

  it('uses default version URL', async () => {
    const fetch = mockFetch({ version: 'v1.0.0' })
    await checkForUpdate({ currentVersion: 'v1.0.0', fetchImpl: fetch })

    expect(fetch).toHaveBeenCalledWith('/version.json', expect.any(Object))
  })

  it('uses custom version URL', async () => {
    const fetch = mockFetch({ version: 'v1.0.0' })
    await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
      versionUrl: '/custom-version.json',
    })

    expect(fetch).toHaveBeenCalledWith('/custom-version.json', expect.any(Object))
  })

  it('passes abort signal to fetch', async () => {
    const controller = new AbortController()
    const fetch = mockFetch({ version: 'v1.0.0' })
    await checkForUpdate({
      currentVersion: 'v1.0.0',
      fetchImpl: fetch,
      signal: controller.signal,
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    )
  })
})

describe('startVersionPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onUpdateDetected when an update is found', async () => {
    const fetch = mockFetch({ version: 'v2.0.0', buildTime: '2026-01-01T00:00:00Z' })
    const onUpdate = vi.fn()

    const mockDocument = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document

    const handle = startVersionPolling(onUpdate, {
      fetchImpl: fetch,
      currentVersion: 'v1.0.0',
      intervalMs: 10000,
      documentRef: mockDocument,
      runImmediately: true,
    })

    // Flush only the microtask queue for the initial async check
    await vi.advanceTimersByTimeAsync(0)

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ hasUpdate: true, version: 'v2.0.0' })
    )

    handle.stop()
  })

  it('does not call onUpdateDetected when versions match', async () => {
    const fetch = mockFetch({ version: 'v1.0.0', buildTime: '2026-01-01T00:00:00Z' })
    const onUpdate = vi.fn()

    const mockDocument = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document

    const handle = startVersionPolling(onUpdate, {
      fetchImpl: fetch,
      currentVersion: 'v1.0.0',
      intervalMs: 10000,
      documentRef: mockDocument,
      runImmediately: true,
    })

    await vi.advanceTimersByTimeAsync(0)

    expect(onUpdate).not.toHaveBeenCalled()

    handle.stop()
  })

  it('stop() cleans up listeners and timers', async () => {
    const fetch = mockFetch({ version: 'v1.0.0' })
    const onUpdate = vi.fn()

    const mockDocument = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document

    const handle = startVersionPolling(onUpdate, {
      fetchImpl: fetch,
      currentVersion: 'v1.0.0',
      intervalMs: 1000,
      documentRef: mockDocument,
      runImmediately: false,
    })

    handle.stop()

    expect(mockDocument.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )
  })

  it('skips polling when document is hidden', async () => {
    const fetch = mockFetch({ version: 'v2.0.0' })
    const onUpdate = vi.fn()

    const mockDocument = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document

    const handle = startVersionPolling(onUpdate, {
      fetchImpl: fetch,
      currentVersion: 'v1.0.0',
      intervalMs: 10000,
      documentRef: mockDocument,
      runImmediately: true,
    })

    // Flush initial microtask - runCheck should skip because hidden
    await vi.advanceTimersByTimeAsync(0)

    // fetch should not be called because document is hidden
    expect(fetch).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()

    handle.stop()
  })

  it('respects runImmediately=false', async () => {
    const fetch = mockFetch({ version: 'v2.0.0' })
    const onUpdate = vi.fn()

    const mockDocument = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Document

    const handle = startVersionPolling(onUpdate, {
      fetchImpl: fetch,
      currentVersion: 'v1.0.0',
      intervalMs: 5000,
      documentRef: mockDocument,
      runImmediately: false,
    })

    // No immediate check
    expect(fetch).not.toHaveBeenCalled()

    // After interval, check runs
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetch).toHaveBeenCalled()

    handle.stop()
  })
})
