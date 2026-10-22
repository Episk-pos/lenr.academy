import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import CascadesAll from './CascadesAll'
import { WorkerCancelledError } from '../hooks/workerCancellation'
import { createTestI18n } from '../test-utils/i18nInstance'

// Fake sql.js database: reports DB_NUCLIDES rows in NuclidesPlus
const DB_NUCLIDES = 400
const fakeDb = {
  exec: vi.fn((sql: string) =>
    sql.includes('COUNT(*) FROM NuclidesPlus') ? [{ columns: ['COUNT(*)'], values: [[DB_NUCLIDES]] }] : []
  ),
  export: vi.fn(() => new Uint8Array()),
}

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: fakeDb, isLoading: false, error: null, downloadProgress: null }),
}))

// Stable references so effects depending on them don't loop
const getCascadeState = () => null
const updateCascadeState = vi.fn()
vi.mock('../contexts/QueryStateContext', () => ({
  useQueryState: () => ({ getCascadeState, updateCascadeState }),
}))

const runCascade = vi.fn()
vi.mock('../hooks/useCascadeWorker', () => ({
  useCascadeWorker: () => ({ runCascade, cancelCascade: vi.fn(), progress: null, isRunning: false, error: null }),
}))

vi.mock('../services/queryService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/queryService')>()),
  getAllElements: () => [],
}))

vi.mock('../components/PeriodicTableSelector', () => ({
  default: ({ onSelectionChange }: { onSelectionChange: (ids: string[]) => void }) => (
    <button type="button" data-testid="clear-fuel" onClick={() => onSelectionChange([])} />
  ),
}))
vi.mock('../components/ProportionInput', () => ({ default: () => null }))
vi.mock('../components/MaterialsCatalog', () => ({ default: () => null }))
vi.mock('../components/CascadeTabs', () => ({ default: () => null }))
vi.mock('../components/CascadeProgressCard', () => ({ default: () => null }))

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/cascades${search}`]}>
      <CascadesAll />
    </MemoryRouter>
  )
}

describe('CascadesAll — Max Nuclides derived from the database', () => {
  it('defaults the slider value and maximum to the DB nuclide count', () => {
    renderPage()
    const slider = screen.getByTestId('cascade-max-nuclides') as HTMLInputElement
    expect(slider.max).toBe(String(DB_NUCLIDES))
    expect(slider.value).toBe(String(DB_NUCLIDES))
    expect(screen.getByText(`Max Nuclides to Pair: ${DB_NUCLIDES}`)).toBeInTheDocument()
    expect(screen.getByTestId('cascade-nuclide-count')).toHaveTextContent(`Database has ${DB_NUCLIDES} total nuclides`)
  })

  it('clamps an out-of-range URL value (e.g. the old 5000 default) to the DB count', () => {
    renderPage('?maxNuclides=5000')
    const slider = screen.getByTestId('cascade-max-nuclides') as HTMLInputElement
    expect(slider.value).toBe(String(DB_NUCLIDES))
  })

  it('keeps an explicit in-range URL value', () => {
    renderPage('?maxNuclides=120')
    const slider = screen.getByTestId('cascade-max-nuclides') as HTMLInputElement
    expect(slider.value).toBe('120')
    expect(slider.max).toBe(String(DB_NUCLIDES))
  })
})

describe('CascadesAll — form copy', () => {
  it('explains what the melting/boiling filters exclude at the current temperature', () => {
    renderPage()
    expect(
      screen.getByText('Exclude elements still solid at 2400 K (melting point above the reactor temperature)')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Exclude elements boiled off at 2400 K (boiling point below the reactor temperature)')
    ).toBeInTheDocument()
  })

  it('shows helper text under the inputs', () => {
    renderPage()
    expect(screen.getByText(/Reactor temperature in kelvin/)).toBeInTheDocument()
    expect(screen.getByText(/Only fusion reactions releasing/)).toBeInTheDocument()
    expect(screen.getByText(/Only two-to-two reactions releasing/)).toBeInTheDocument()
    expect(screen.getByText(/The cascade stops once more distinct nuclides/)).toBeInTheDocument()
    expect(screen.getByText(/Each loop reacts the active nuclides/)).toBeInTheDocument()
  })

  it('places the run-time warning next to the Run button', () => {
    renderPage()
    const warning = screen.getByTestId('cascade-runtime-warning')
    expect(warning).toHaveTextContent('30 seconds to 15 minutes')
    const runButton = screen.getByRole('button', { name: /Run Cascade Simulation/ })
    expect(warning.parentElement).toContainElement(runButton)
  })

  it('shows a translated validation error when no fuel is selected', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('clear-fuel'))
    fireEvent.click(screen.getByRole('button', { name: /Run Cascade Simulation/ }))
    return screen.findByText('Please select at least one fuel nuclide').then(el => {
      expect(el).toBeInTheDocument()
      expect(runCascade).not.toHaveBeenCalled()
    })
  })
})

describe('CascadesAll — cancellation in a non-English locale', () => {
  it('does not show the translated cancel rejection as an error', async () => {
    const de = await createTestI18n('de')
    const cancelMsg = de.t('errors.simulationCancelledByUser')
    expect(cancelMsg).not.toBe('Simulation cancelled by user')
    runCascade.mockRejectedValueOnce(new WorkerCancelledError(cancelMsg))

    render(
      <I18nextProvider i18n={de}>
        <MemoryRouter initialEntries={['/cascades']}>
          <CascadesAll />
        </MemoryRouter>
      </I18nextProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: new RegExp(de.t('cascades.runSimulation')) }))

    await waitFor(() => expect(runCascade).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText(cancelMsg)).toBeNull()
    expect(screen.queryByText(de.t('common.error'))).toBeNull()
  })
})
