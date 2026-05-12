import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQueryWorker } from './useQueryWorker'

// Track mock worker instances
let mockWorkerInstance: any = null

// Mock the Worker constructor globally
vi.stubGlobal('Worker', class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  constructor() {
    mockWorkerInstance = this
  }

  postMessage(_data: any) {
    // no-op
  }

  terminate() {
    // no-op
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('useQueryWorker', () => {
  beforeEach(() => {
    mockWorkerInstance = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with isRunning=false and no error', () => {
    const { result } = renderHook(() => useQueryWorker())

    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('provides a runQuery function', () => {
    const { result } = renderHook(() => useQueryWorker())
    expect(typeof result.current.runQuery).toBe('function')
  })

  it('creates a worker on mount', () => {
    renderHook(() => useQueryWorker())
    expect(mockWorkerInstance).not.toBeNull()
  })

  it('resolves with query result on worker complete message', async () => {
    const { result } = renderHook(() => useQueryWorker())
    const buffer = new ArrayBuffer(8)

    let queryPromise: Promise<any>

    act(() => {
      queryPromise = result.current.runQuery('fusion', { element1List: ['H'] }, buffer)
    })

    // Simulate worker response
    await act(async () => {
      if (mockWorkerInstance?.onmessage) {
        mockWorkerInstance.onmessage(new MessageEvent('message', {
          data: {
            type: 'complete',
            result: {
              reactions: [{ E1: 'H', MeV: 1.5 }],
              nuclides: [],
              elements: [],
              executionTime: 42,
              rowCount: 1,
              totalCount: 1,
              radioactiveNuclides: ['H-3'],
            },
          },
        }))
      }
    })

    const queryResult = await queryPromise!
    expect(queryResult.reactions).toHaveLength(1)
    expect(queryResult.radioactiveNuclides).toBeInstanceOf(Set)
    expect(queryResult.radioactiveNuclides.has('H-3')).toBe(true)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error state on worker error message', async () => {
    const { result } = renderHook(() => useQueryWorker())
    const buffer = new ArrayBuffer(8)

    // Start query but catch the rejection to prevent unhandled promise rejection
    let rejected = false
    act(() => {
      result.current.runQuery('fusion', {}, buffer).catch(() => {
        rejected = true
      })
    })

    await act(async () => {
      if (mockWorkerInstance?.onmessage) {
        mockWorkerInstance.onmessage(new MessageEvent('message', {
          data: {
            type: 'error',
            error: 'SQL execution failed',
          },
        }))
      }
    })

    // Wait for microtask queue to flush (rejection propagation)
    await vi.waitFor(() => {
      expect(rejected).toBe(true)
    })
    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBe('SQL execution failed')
  })
})
