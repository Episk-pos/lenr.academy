import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Database } from 'sql.js'
import en from '../i18n/locales/en.json'
import { mockReactI18next } from '../test-utils/i18nMock'
import { createRadioNuclidesFixtureDb } from '../test-utils/radioNuclidesFixture'
import type { Nuclide } from '../types'

vi.mock('react-i18next', () => mockReactI18next)

// Real queryService against an in-memory sql.js DB seeded with parkhomov.db rows
const fixture = vi.hoisted(() => ({ db: null as Database | null }))

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: fixture.db }),
}))

vi.mock('../services/decayChainService', () => ({
  traceDecayChain: () => null,
}))

vi.mock('./DecayChainDiagram', () => ({ default: () => null }))

import NuclideDetailsCard from './NuclideDetailsCard'

// NuclidesPlus rows (parkhomov.db v1.2.2)
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

const cobalt60: Nuclide = {
  id: 69, Z: 27, A: 60, E: 'Co', BE: 524.79254678764, AMU: 59.933815667, nBorF: 'b', aBorF: 'f',
  logHalfLife: 0.7219, SUS: 'SYN', RDM: 'G, B-', DEMeV: 1.3325, SP: '5+',
}

const barium137: Nuclide = {
  id: 188, Z: 56, A: 137, E: 'Ba', BE: 1149.6495093471, AMU: 136.905827375, nBorF: 'f', aBorF: 'f',
  logHalfLife: 50, SUS: 'SPN', DEMeV: 0, SP: '3/2+',
}

const caesium135: Nuclide = {
  id: 310, Z: 55, A: 135, E: 'Cs', BE: 1134.1500760245, AMU: 134.905977234, nBorF: 'f', aBorF: 'b',
  logHalfLife: 6.3617, SUS: 'UPN', RDM: 'B-', DEMeV: 0.0759, SP: '7/2+',
}

const uranium238: Nuclide = {
  id: 291, Z: 92, A: 238, E: 'U', BE: 1801.6362241555, AMU: 238.050786996, nBorF: 'b', aBorF: 'b',
  logHalfLife: 9.6504, SUS: 'UPN', RDM: 'A or SF or 2 B-', DEMeV: 4.27,
}

function renderCard(nuclide: Nuclide) {
  return render(
    <MemoryRouter>
      <NuclideDetailsCard nuclide={nuclide} />
    </MemoryRouter>
  )
}

const primaryDecayLabel = `${en.elementData.primaryDecay}:`

describe('NuclideDetailsCard', () => {
  beforeAll(async () => {
    fixture.db = await createRadioNuclidesFixtureDb()
  })

  afterAll(() => {
    fixture.db?.close()
    fixture.db = null
  })

  it('shows the T-3 half-life in natural units and the radioactive badge', () => {
    renderCard(tritium)

    expect(screen.getByTestId('nuclide-half-life')).toHaveTextContent('12.33 years')
    expect(screen.getByTitle(en.reactions.radioactive)).toBeInTheDocument()
    expect(screen.getByTestId('nuclide-classification')).toHaveTextContent(en.elementData.status.synthetic)
    expect(screen.getByText(primaryDecayLabel).nextSibling).toHaveTextContent('B-')
  })

  it('shows the Co-60 ground-state half-life (5.2714 years), not the Co-60m isomer', () => {
    renderCard(cobalt60)

    expect(screen.getByTestId('nuclide-half-life')).toHaveTextContent('5.2714 years')
    expect(screen.getByTestId('nuclide-half-life')).not.toHaveTextContent('minutes')
    expect(screen.getByTitle(en.reactions.radioactive)).toBeInTheDocument()
  })

  it('shows the long Cs-135 half-life, not the 53-minute isomer', () => {
    renderCard(caesium135)

    expect(screen.getByTestId('nuclide-half-life')).toHaveTextContent('2.30e+6 years')
  })

  it('formats the U-238 half-life exponentially (4.47e+9 years)', () => {
    renderCard(uranium238)

    expect(screen.getByTestId('nuclide-half-life')).toHaveTextContent('4.47e+9 years')
    expect(screen.getByText(primaryDecayLabel).nextSibling).toHaveTextContent('A or SF or 2 B-')
  })

  it('shows Ba-137 as stable: no radioactive badge, no isomer half-life, no IT primary decay', () => {
    renderCard(barium137)

    expect(screen.queryByTitle(en.reactions.radioactive)).not.toBeInTheDocument()
    expect(screen.getByText(en.elements.stableOrLongLived)).toBeInTheDocument()
    expect(screen.getByTestId('nuclide-half-life')).not.toHaveTextContent('minutes')
    expect(screen.queryByText(primaryDecayLabel)).not.toBeInTheDocument()
  })

  it('shows D-2 as stable without a radioactive badge', () => {
    renderCard(deuterium)

    expect(screen.queryByTitle(en.reactions.radioactive)).not.toBeInTheDocument()
    expect(screen.getByText(en.elements.stableOrLongLived)).toBeInTheDocument()
    expect(screen.getByTestId('nuclide-classification')).toHaveTextContent(en.elementData.status.stablePrimordial)
  })

  it('shows nuclear spin and magnetic moment when available', () => {
    renderCard(deuterium)

    expect(screen.getByTestId('nuclide-spin')).toHaveTextContent('1+')
    expect(screen.getByText('0.8574 μₙ')).toBeInTheDocument()
  })
})
