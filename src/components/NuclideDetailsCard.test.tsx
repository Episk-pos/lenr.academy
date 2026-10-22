import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import en from '../i18n/locales/en.json'
import { mockReactI18next } from '../test-utils/i18nMock'
import type { DecayData, Nuclide } from '../types'

vi.mock('react-i18next', () => mockReactI18next)

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: {} }),
}))

const mockGetDecayData = vi.fn<(db: unknown, Z: number, A: number) => DecayData[]>()

vi.mock('../services/queryService', () => ({
  getRadioactiveDecayData: (db: unknown, Z: number, A: number) => mockGetDecayData(db, Z, A),
  getElementSymbolByZ: () => null,
  getNuclideBySymbol: () => null,
}))

vi.mock('../services/decayChainService', () => ({
  traceDecayChain: () => null,
}))

vi.mock('./DecayChainDiagram', () => ({ default: () => null }))

import NuclideDetailsCard from './NuclideDetailsCard'

// Tritium and deuterium rows as stored in NuclidesPlus (parkhomov.db v1.2.2)
const tritium: Nuclide = {
  id: 5, Z: 1, A: 3, E: 'T', BE: 8.48111224352, AMU: 3.01604928199, nBorF: 'f', aBorF: 'b',
  logHalfLife: 1.0906, BEN: 2.82703741451, SUS: 'SYN', RDM: 'B-', DEMeV: 0.0186,
  pcaNCrust: 0, ppmNCrust: 0, SP: '1/2+', MD: '2.9789624600',
}

const deuterium: Nuclide = {
  id: 4, Z: 1, A: 2, E: 'D', BE: 2.2241141107, AMU: 2.01410177811, nBorF: 'b', aBorF: 'f',
  logHalfLife: 50, BEN: 1.11205705535, SUS: 'SPN', DEMeV: 0, pcaNCrust: 0.015, ppmNCrust: 0.21,
  ppmNSolar: 23, SP: '1+', MD: '0.8574382310',
}

// RadioNuclides stores tritium as E='H', Z=1, A=3 — the card looks it up by Z/A
const tritiumDecay: DecayData[] = [{
  decayMode: 'B-', radiationType: 'B-', energyKeV: 5.69, intensity: 100, halfLife: 12.33, halfLifeUnits: 'Y',
}]

function renderCard(nuclide: Nuclide) {
  return render(
    <MemoryRouter>
      <NuclideDetailsCard nuclide={nuclide} />
    </MemoryRouter>
  )
}

describe('NuclideDetailsCard', () => {
  beforeEach(() => {
    mockGetDecayData.mockReset()
  })

  it('shows the T-3 half-life in natural units and the radioactive badge', () => {
    mockGetDecayData.mockReturnValue(tritiumDecay)
    renderCard(tritium)

    expect(mockGetDecayData).toHaveBeenCalledWith(expect.anything(), 1, 3)
    expect(screen.getByTestId('nuclide-half-life')).toHaveTextContent('12.33 years')
    expect(screen.getAllByTitle(en.reactions.radioactive).length).toBeGreaterThan(0)
    expect(screen.getByTestId('nuclide-classification')).toHaveTextContent(en.elementData.status.synthetic)
    expect(screen.getByText(en.elementData.primaryDecay + ':')).toBeInTheDocument()
  })

  it('shows D-2 as stable without a radioactive badge', () => {
    mockGetDecayData.mockReturnValue([])
    renderCard(deuterium)

    expect(screen.queryByTitle(en.reactions.radioactive)).not.toBeInTheDocument()
    expect(screen.getByText(en.elements.stableOrLongLived)).toBeInTheDocument()
    expect(screen.getByTestId('nuclide-classification')).toHaveTextContent(en.elementData.status.stablePrimordial)
  })

  it('shows nuclear spin and magnetic moment when available', () => {
    mockGetDecayData.mockReturnValue([])
    renderCard(deuterium)

    expect(screen.getByTestId('nuclide-spin')).toHaveTextContent('1+')
    expect(screen.getByText('0.8574 μₙ')).toBeInTheDocument()
  })
})
