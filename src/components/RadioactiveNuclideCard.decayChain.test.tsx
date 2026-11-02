import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Database } from 'sql.js'
import en from '../i18n/locales/en.json'
import { mockReactI18next } from '../test-utils/i18nMock'
import { createDecayChainFixtureDb } from '../test-utils/decayChainFixture'
import { getRadioactiveNuclideData } from '../services/queryService'

vi.mock('react-i18next', () => mockReactI18next)

// Real queryService + decayChainService against an in-memory sql.js DB seeded with parkhomov.db rows
const fixture = vi.hoisted(() => ({ db: null as Database | null }))

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: fixture.db }),
}))

// jsdom has no ResizeObserver; render the diagram content without pan/zoom
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: (args: Record<string, () => void>) => React.ReactNode }) =>
    <div>{children({ zoomIn: vi.fn(), zoomOut: vi.fn(), resetTransform: vi.fn() })}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import RadioactiveNuclideCard from './RadioactiveNuclideCard'

function renderCard(E: string, A: number) {
  const nuclideData = getRadioactiveNuclideData(fixture.db!, E, A)
  expect(nuclideData).not.toBeNull()
  return render(
    <MemoryRouter>
      <RadioactiveNuclideCard nuclideData={nuclideData!} />
    </MemoryRouter>
  )
}

describe('RadioactiveNuclideCard decay chain', () => {
  beforeAll(async () => {
    fixture.db = await createDecayChainFixtureDb()
  })

  afterAll(() => {
    fixture.db?.close()
    fixture.db = null
  })

  it('renders the Decay Chain Visualization section for Pb-212 (no NuclidesPlus row)', () => {
    renderCard('Pb', 212)

    const section = screen.getByTestId('decay-chain-section')
    expect(within(section).getByText(en.elements.decayChainVisualization)).toBeInTheDocument()

    fireEvent.click(within(section).getByRole('button', { name: en.elements.expandDecayChain }))
    expect(within(section).getByRole('button', { name: en.elements.collapseDecayChain })).toBeInTheDocument()

    // Default controls: depth 5, min branching 10% -> Bi-212 branches to Po-212 and Tl-208, both to Pb-208,
    // which is listed once
    const terminals = screen.getByTestId('decay-chain-terminals')
    expect(terminals).toHaveTextContent('Pb-208')
    expect(terminals).not.toHaveTextContent('Pb-208, Pb-208')
    expect(terminals).toHaveTextContent(`(1 ${en.elements.stableCount}, 0 ${en.elements.radioactiveCount})`)
    expect(section).toHaveTextContent(`${en.elements.branchCount}: 1`)

    for (const node of ['Pb-212', 'Bi-212', 'Po-212', 'Tl-208', 'Pb-208']) {
      expect(within(section).getAllByText(node).length).toBeGreaterThan(0)
    }
  })

  it('renders the section for Ra-224 as well', () => {
    renderCard('Ra', 224)

    expect(screen.getByTestId('decay-chain-section')).toBeInTheDocument()
  })
})
