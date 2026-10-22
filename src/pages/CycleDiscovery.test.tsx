import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'
import CycleDiscovery from './CycleDiscovery'
import { WorkerCancelledError } from '../hooks/workerCancellation'
import { createTestI18n } from '../test-utils/i18nInstance'

const fakeDb = { export: vi.fn(() => new Uint8Array()) }
vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: fakeDb }),
}))

const getCycleDiscoveryState = () => null
const updateCycleDiscoveryState = vi.fn()
vi.mock('../contexts/QueryStateContext', () => ({
  useQueryState: () => ({ getCycleDiscoveryState, updateCycleDiscoveryState }),
}))

const runDiscovery = vi.fn()
vi.mock('../hooks/useCycleDiscoveryWorker', () => ({
  useCycleDiscoveryWorker: () => ({
    runDiscovery,
    cancelDiscovery: vi.fn(),
    progress: null,
    isRunning: false,
    error: null,
  }),
}))

vi.mock('../components/CycleDiscoverySearch', () => ({
  default: ({ onSearch }: { onSearch: () => void }) => (
    <button type="button" data-testid="search" onClick={onSearch} />
  ),
}))
vi.mock('../components/CycleResultsTable', () => ({ default: () => null }))
vi.mock('../components/CycleVisualization', () => ({ default: () => null }))

let de: I18nInstance
beforeAll(async () => {
  de = await createTestI18n('de')
})

function renderDe() {
  return render(
    <I18nextProvider i18n={de}>
      <MemoryRouter>
        <CycleDiscovery />
      </MemoryRouter>
    </I18nextProvider>
  )
}

describe('CycleDiscovery cancellation in a non-English locale', () => {
  beforeEach(() => {
    runDiscovery.mockReset()
  })

  it('does not show the translated cancel rejection as an error', async () => {
    const cancelMsg = de.t('errors.discoveryCancelledByUser')
    expect(cancelMsg).not.toBe('Cycle discovery cancelled by user')
    runDiscovery.mockRejectedValue(new WorkerCancelledError(cancelMsg))

    renderDe()
    fireEvent.click(screen.getByTestId('search'))

    await waitFor(() => expect(runDiscovery).toHaveBeenCalled())
    // Let the rejection settle
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText(cancelMsg)).toBeNull()
    expect(screen.queryByText(de.t('common.error'))).toBeNull()
  })

  it('still shows genuine errors', async () => {
    runDiscovery.mockRejectedValue(new Error('boom'))
    renderDe()
    fireEvent.click(screen.getByTestId('search'))
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
