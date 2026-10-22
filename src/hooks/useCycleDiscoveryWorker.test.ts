import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'
import { useCycleDiscoveryWorker } from './useCycleDiscoveryWorker'
import { isWorkerCancelled } from './workerCancellation'
import { createTestI18n } from '../test-utils/i18nInstance'
import type { CycleDiscoveryParameters, CycleDiscoveryResults } from '../types'

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

vi.stubGlobal('Worker', vi.fn(function () {
  return new MockWorker()
}))
vi.stubGlobal('URL', class MockURL extends URL {
  constructor(url: string, base?: string | URL) {
    super(url, base || 'http://localhost')
  }
})

const params: CycleDiscoveryParameters = {
  minFusionMeV: 0,
  minTwoToTwoMeV: 0,
  maxCycleDepth: 4,
  includeFission: false,
  maxCycles: 10,
}

let de: I18nInstance
beforeAll(async () => {
  de = await createTestI18n('de')
})

describe('useCycleDiscoveryWorker cancellation (non-English locale)', () => {
  it('rejects with a flagged, translated cancellation error', async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(I18nextProvider, { i18n: de }, children)
    const { result } = renderHook(() => useCycleDiscoveryWorker(), { wrapper })

    let promise!: Promise<CycleDiscoveryResults>
    act(() => {
      promise = result.current.runDiscovery(params, new ArrayBuffer(8))
    })
    act(() => {
      result.current.cancelDiscovery()
    })

    const err = await promise.catch((e: unknown) => e)
    expect(isWorkerCancelled(err)).toBe(true)
    expect((err as Error).message).toBe('Zyklensuche vom Benutzer abgebrochen')
    expect(result.current.error).toBe('Suche abgebrochen')
  })
})
