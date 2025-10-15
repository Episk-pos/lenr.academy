export interface SpecialParticleInfo {
  /** Identifier as stored in the NuclidesPlus table */
  id: 'e-' | 'n*' | 'nu'
  /** Symbol to display in the UI */
  displaySymbol: string
  /** Human-friendly name */
  name: string
  /** Short description about the particle */
  description: string
  /** Atomic number (proton count) used in the database */
  atomicNumber: number
  /** Mass number stored in the database (A) */
  massNumber: number
  /** Electric charge in units of elementary charge */
  charge: number
  /** Periodic table layout position (uses unused cells for spacing) */
  position: { period: number; group: number }
}

export const SPECIAL_PARTICLES: SpecialParticleInfo[] = [
  {
    id: 'e-',
    displaySymbol: 'e⁻',
    name: 'Electron',
    description: 'Fundamental lepton with negative electric charge that orbits atomic nuclei.',
    atomicNumber: -1,
    massNumber: 0,
    charge: -1,
    position: { period: 2, group: 5 }
  },
  {
    id: 'n*',
    displaySymbol: 'n⁰',
    name: 'Neutron',
    description: 'Neutral baryon found in the nucleus of nearly all atoms.',
    atomicNumber: 0,
    massNumber: 1,
    charge: 0,
    position: { period: 2, group: 8 }
  },
  {
    id: 'nu',
    displaySymbol: 'ν',
    name: 'Neutrino',
    description: 'Nearly massless, electrically neutral lepton that interacts only via the weak force.',
    atomicNumber: 0,
    massNumber: 0,
    charge: 0,
    position: { period: 2, group: 11 }
  }
]

export const SPECIAL_PARTICLE_IDS = SPECIAL_PARTICLES.map(p => p.id)

export const SPECIAL_PARTICLES_BY_ID = SPECIAL_PARTICLES.reduce<Record<string, SpecialParticleInfo>>((acc, particle) => {
  acc[particle.id] = particle
  return acc
}, {})
