/**
 * Famous Natural Decay Series Constants
 *
 * Defines the four naturally occurring and synthetic radioactive decay series.
 * Each series is characterized by a long-lived parent isotope and a chain of
 * radioactive daughters that eventually reach a stable endpoint.
 */

export interface DecaySeriesPreset {
  id: string
  name: string
  parent: { Z: number; A: number; E: string }
  stableEndpoint: { Z: number; A: number; E: string }
  expectedGenerations: number
  description: string
  wikipediaUrl: string
  characteristics: string[]
}

export const DECAY_SERIES_PRESETS: DecaySeriesPreset[] = [
  {
    id: 'uranium-238',
    name: 'Uranium-238 Series (4n+2)',
    parent: { Z: 92, A: 238, E: 'U' },
    stableEndpoint: { Z: 82, A: 206, E: 'Pb' },
    expectedGenerations: 14,
    description: 'The most abundant natural decay series, also called the radium series',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Decay_chain#Uranium_series',
    characteristics: [
      'Half-life: 4.47 billion years',
      'Includes radon-222 (radioactive gas)',
      'Terminates at stable lead-206',
      'Named after parent nuclide mass (238 = 4×59 + 2)'
    ]
  },
  {
    id: 'thorium-232',
    name: 'Thorium-232 Series (4n)',
    parent: { Z: 90, A: 232, E: 'Th' },
    stableEndpoint: { Z: 82, A: 208, E: 'Pb' },
    expectedGenerations: 10,
    description: 'The second most common natural decay series',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Decay_chain#Thorium_series',
    characteristics: [
      'Half-life: 14.05 billion years',
      'Includes radon-220 (thoron gas)',
      'Terminates at stable lead-208',
      'All members have mass numbers divisible by 4'
    ]
  },
  {
    id: 'uranium-235',
    name: 'Uranium-235 Actinium Series (4n+3)',
    parent: { Z: 92, A: 235, E: 'U' },
    stableEndpoint: { Z: 82, A: 207, E: 'Pb' },
    expectedGenerations: 11,
    description: 'The actinium decay series, important for nuclear fission',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Decay_chain#Actinium_series',
    characteristics: [
      'Half-life: 704 million years',
      'Includes actinium-227 (rare actinide)',
      'Terminates at stable lead-207',
      'Named after actinium, a key member'
    ]
  },
  {
    id: 'neptunium-237',
    name: 'Neptunium-237 Series (4n+1)',
    parent: { Z: 93, A: 237, E: 'Np' },
    stableEndpoint: { Z: 83, A: 209, E: 'Bi' },
    expectedGenerations: 11,
    description: 'Synthetic decay series, no long-lived natural members',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Decay_chain#Neptunium_series',
    characteristics: [
      'Half-life: 2.14 million years',
      'Created artificially in nuclear reactors',
      'Terminates at stable bismuth-209',
      'Only decay series not found in nature'
    ]
  }
]

/**
 * Get decay series preset by ID
 */
export function getDecaySeriesById(id: string): DecaySeriesPreset | undefined {
  return DECAY_SERIES_PRESETS.find(series => series.id === id)
}

/**
 * Get decay series preset by parent nuclide
 */
export function getDecaySeriesByParent(Z: number, A: number): DecaySeriesPreset | undefined {
  return DECAY_SERIES_PRESETS.find(series => series.parent.Z === Z && series.parent.A === A)
}

/**
 * Check if a nuclide is the parent of a famous decay series
 */
export function isFamousDecaySeriesParent(Z: number, A: number): boolean {
  return getDecaySeriesByParent(Z, A) !== undefined
}
