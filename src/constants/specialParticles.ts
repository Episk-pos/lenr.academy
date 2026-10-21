export interface SpecialParticleInfo {
  /** Identifier as stored in the NuclidesPlus table */
  id: 'e-' | 'n*' | 'nu'
  /** Symbol to display in the UI */
  displaySymbol: string
  /** Human-friendly name (English; prefer `nameKey` for UI display) */
  name: string
  /** i18n key for the translated particle name */
  nameKey: string
  /** Short description about the particle */
  description: string
  /** Atomic number (proton count) used in the database */
  atomicNumber: number
  /** Mass number stored in the database (A) */
  massNumber: number
  /** Electric charge in units of elementary charge */
  charge: number
  /** Periodic table layout position (occupies an empty cell in the period-1 gap) */
  position: { period: number; group: number }
}

export const SPECIAL_PARTICLES: SpecialParticleInfo[] = [
  {
    id: 'e-',
    displaySymbol: 'e⁻',
    name: 'Electron',
    nameKey: 'elements.particleElectron',
    description: 'Fundamental lepton with negative electric charge that orbits atomic nuclei.',
    atomicNumber: -1,
    massNumber: 0,
    charge: -1,
    position: { period: 1, group: 5 }
  },
  {
    id: 'n*',
    displaySymbol: 'n⁰',
    name: 'Neutron',
    nameKey: 'elements.particleNeutron',
    description: 'Neutral baryon found in the nucleus of nearly all atoms.',
    atomicNumber: 0,
    massNumber: 1,
    charge: 0,
    position: { period: 1, group: 6 }
  },
  {
    id: 'nu',
    displaySymbol: 'ν',
    name: 'Neutrino',
    nameKey: 'elements.particleNeutrino',
    description: 'Nearly massless, electrically neutral lepton that interacts only via the weak force.',
    atomicNumber: 0,
    massNumber: 0,
    charge: 0,
    position: { period: 1, group: 7 }
  }
]

export const SPECIAL_PARTICLE_IDS = SPECIAL_PARTICLES.map(p => p.id)

export const SPECIAL_PARTICLES_BY_ID = SPECIAL_PARTICLES.reduce<Record<string, SpecialParticleInfo>>((acc, particle) => {
  acc[particle.id] = particle
  return acc
}, {})

export interface HydrogenIsotopeTileInfo {
  /** Symbol as stored in the database (hydrogen isotopes use distinct symbols) */
  symbol: 'D' | 'T'
  /** Mass number shown in the tile's number slot */
  massNumber: number
  /** i18n key for the translated isotope name */
  nameKey: string
  /** Periodic table layout position (immediately right of H in period 1) */
  position: { period: number; group: number }
}

export const HYDROGEN_ISOTOPE_TILES: HydrogenIsotopeTileInfo[] = [
  { symbol: 'D', massNumber: 2, nameKey: 'elements.deuterium', position: { period: 1, group: 2 } },
  { symbol: 'T', massNumber: 3, nameKey: 'elements.tritium', position: { period: 1, group: 3 } }
]
