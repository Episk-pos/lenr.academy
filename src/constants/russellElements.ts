/**
 * Walter Russell's Nine-Octave Periodic Table (1926)
 *
 * Russell arranged elements in a wave-based system of 9 octaves with a
 * serpentine (S-curve) pattern. Each octave has a generation (charging) side
 * and a radiation (discharging) side, with an inert gas at the balance point.
 *
 * Russell predicted Deuterium, Tritium, Neptunium, and Plutonium before
 * their official discovery.
 *
 * Source: "The Universal One" (1926) and "A New Concept of the Universe" (1953)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Position within an octave: -4 (Gen 4) through 0 (Inert Gas) to +4 (Rad 4) */
export type OctavePosition = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4

/** Which side of the octave an element falls on */
export type OctaveSide = 'generation' | 'radiation' | 'inertGas'

/** Whether Russell predicted this element before official discovery */
export type PredictionStatus = 'known' | 'predicted' | 'hypothetical'

export interface RussellElement {
  /** Russell's name for this element */
  russellName: string
  /** Modern element symbol (if known) */
  modernSymbol?: string
  /** Modern element name */
  modernName?: string
  /** Atomic number Z (if known) */
  Z?: number
  /** Position in octave: -4 to +4 */
  position: OctavePosition
  /** Which side: generation, radiation, or inert gas */
  side: OctaveSide
  /** Known, predicted by Russell, or hypothetical */
  status: PredictionStatus
  /** Note about Russell's prediction or naming */
  note?: string
}

export interface RussellOctave {
  /** Octave number (1-10) */
  number: number
  /** Name of the inert gas at the fulcrum */
  inertGasName: string
  /** Elements in this octave */
  elements: RussellElement[]
}

// ─── Color Constants ─────────────────────────────────────────────────────────

export const RUSSELL_COLORS = {
  generation: {
    light: '#d97706', // amber-600
    dark: '#f59e0b',  // amber-500
    bg: {
      light: '#fef3c7', // amber-100
      dark: '#78350f',  // amber-900
    },
  },
  radiation: {
    light: '#2563eb', // blue-600
    dark: '#60a5fa',  // blue-400
    bg: {
      light: '#dbeafe', // blue-100
      dark: '#1e3a5f',  // blue-900ish
    },
  },
  inertGas: {
    light: '#6b7280', // gray-500
    dark: '#9ca3af',  // gray-400
    bg: {
      light: '#f3f4f6', // gray-100
      dark: '#374151',  // gray-700
    },
  },
  carbon: {
    light: '#b45309', // amber-700
    dark: '#fbbf24',  // amber-400
    bg: {
      light: '#fde68a', // amber-200
      dark: '#92400e',  // amber-800
    },
  },
  predicted: {
    light: '#059669', // emerald-600
    dark: '#34d399',  // emerald-400
    bg: {
      light: '#d1fae5', // emerald-100
      dark: '#064e3b',  // emerald-900
    },
  },
  hypothetical: {
    light: '#78716c', // stone-500
    dark: '#a8a29e',  // stone-400
    bg: {
      light: '#f5f5f4', // stone-100
      dark: '#44403c',  // stone-700
    },
  },
} as const

// ─── Octave Data ─────────────────────────────────────────────────────────────

export const RUSSELL_OCTAVES: RussellOctave[] = [
  // Octave 1: ALPHANON (hypothetical)
  {
    number: 1,
    inertGasName: 'Alphanon',
    elements: [
      {
        russellName: 'Alphanon',
        position: 0,
        side: 'inertGas',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalFirstInertGas',
      },
    ],
  },

  // Octave 2: BETANON (hypothetical)
  {
    number: 2,
    inertGasName: 'Betanon',
    elements: [
      {
        russellName: 'Betanon',
        position: 0,
        side: 'inertGas',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalSecondInertGas',
      },
    ],
  },

  // Octave 3: GAMMANON (hypothetical)
  {
    number: 3,
    inertGasName: 'Gammanon',
    elements: [
      {
        russellName: 'Gammanon',
        position: 0,
        side: 'inertGas',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalThirdInertGas',
      },
    ],
  },

  // Octave 4: HYDRON — first octave with known elements
  {
    number: 4,
    inertGasName: 'Helionon',
    elements: [
      {
        russellName: 'Hydrogen',
        modernSymbol: 'H',
        modernName: 'Hydrogen',
        Z: 1,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Ethlogen',
        modernSymbol: 'D',
        modernName: 'Deuterium',
        Z: 1,
        position: -3,
        side: 'generation',
        status: 'predicted',
        note: 'russellChart.notes.ethlogenPrediction',
      },
      {
        russellName: 'Bebegen',
        modernSymbol: 'T',
        modernName: 'Tritium',
        Z: 1,
        position: -2,
        side: 'generation',
        status: 'predicted',
        note: 'russellChart.notes.bebegenPrediction',
      },
      {
        russellName: 'Carbogen',
        position: -1,
        side: 'generation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalElement',
      },
      {
        russellName: 'Helionon',
        modernSymbol: 'He',
        modernName: 'Helium',
        Z: 2,
        position: 0,
        side: 'inertGas',
        status: 'known',
        note: 'russellChart.notes.heliumPlacement',
      },
      {
        russellName: 'Luminon',
        position: 1,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalElement',
      },
      {
        russellName: 'Halanon',
        position: 2,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalElement',
      },
      {
        russellName: 'Helion',
        position: 3,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalElement',
      },
    ],
  },

  // Octave 5: HELIUM octave (Li through F, with Carbon at the amplitude)
  {
    number: 5,
    inertGasName: 'Neon',
    elements: [
      {
        russellName: 'Lithium',
        modernSymbol: 'Li',
        modernName: 'Lithium',
        Z: 3,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Beryllium',
        modernSymbol: 'Be',
        modernName: 'Beryllium',
        Z: 4,
        position: -3,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Boron',
        modernSymbol: 'B',
        modernName: 'Boron',
        Z: 5,
        position: -2,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Carbon',
        modernSymbol: 'C',
        modernName: 'Carbon',
        Z: 6,
        position: -1,
        side: 'generation',
        status: 'known',
        note: 'russellChart.notes.carbonAmplitude',
      },
      {
        russellName: 'Neon',
        modernSymbol: 'Ne',
        modernName: 'Neon',
        Z: 10,
        position: 0,
        side: 'inertGas',
        status: 'known',
      },
      {
        russellName: 'Nitrogen',
        modernSymbol: 'N',
        modernName: 'Nitrogen',
        Z: 7,
        position: 1,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Oxygen',
        modernSymbol: 'O',
        modernName: 'Oxygen',
        Z: 8,
        position: 2,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Fluorine',
        modernSymbol: 'F',
        modernName: 'Fluorine',
        Z: 9,
        position: 3,
        side: 'radiation',
        status: 'known',
      },
    ],
  },

  // Octave 6: NEON octave (Na through Cl)
  {
    number: 6,
    inertGasName: 'Argon',
    elements: [
      {
        russellName: 'Sodium',
        modernSymbol: 'Na',
        modernName: 'Sodium',
        Z: 11,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Magnesium',
        modernSymbol: 'Mg',
        modernName: 'Magnesium',
        Z: 12,
        position: -3,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Aluminium',
        modernSymbol: 'Al',
        modernName: 'Aluminium',
        Z: 13,
        position: -2,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Silicon',
        modernSymbol: 'Si',
        modernName: 'Silicon',
        Z: 14,
        position: -1,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Argon',
        modernSymbol: 'Ar',
        modernName: 'Argon',
        Z: 18,
        position: 0,
        side: 'inertGas',
        status: 'known',
      },
      {
        russellName: 'Phosphorus',
        modernSymbol: 'P',
        modernName: 'Phosphorus',
        Z: 15,
        position: 1,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Sulphur',
        modernSymbol: 'S',
        modernName: 'Sulphur',
        Z: 16,
        position: 2,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Chlorine',
        modernSymbol: 'Cl',
        modernName: 'Chlorine',
        Z: 17,
        position: 3,
        side: 'radiation',
        status: 'known',
      },
    ],
  },

  // Octave 7: ARGON octave (K through Br, with transition metals in middle)
  {
    number: 7,
    inertGasName: 'Krypton',
    elements: [
      {
        russellName: 'Potassium',
        modernSymbol: 'K',
        modernName: 'Potassium',
        Z: 19,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Calcium',
        modernSymbol: 'Ca',
        modernName: 'Calcium',
        Z: 20,
        position: -3,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Scandium',
        modernSymbol: 'Sc',
        modernName: 'Scandium',
        Z: 21,
        position: -2,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Titanium',
        modernSymbol: 'Ti',
        modernName: 'Titanium',
        Z: 22,
        position: -1,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Krypton',
        modernSymbol: 'Kr',
        modernName: 'Krypton',
        Z: 36,
        position: 0,
        side: 'inertGas',
        status: 'known',
      },
      {
        russellName: 'Arsenic',
        modernSymbol: 'As',
        modernName: 'Arsenic',
        Z: 33,
        position: 1,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Selenium',
        modernSymbol: 'Se',
        modernName: 'Selenium',
        Z: 34,
        position: 2,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Bromine',
        modernSymbol: 'Br',
        modernName: 'Bromine',
        Z: 35,
        position: 3,
        side: 'radiation',
        status: 'known',
      },
    ],
  },

  // Octave 8: KRYPTON octave (Rb through I, with rare earths in middle)
  {
    number: 8,
    inertGasName: 'Xenon',
    elements: [
      {
        russellName: 'Rubidium',
        modernSymbol: 'Rb',
        modernName: 'Rubidium',
        Z: 37,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Strontium',
        modernSymbol: 'Sr',
        modernName: 'Strontium',
        Z: 38,
        position: -3,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Yttrium',
        modernSymbol: 'Y',
        modernName: 'Yttrium',
        Z: 39,
        position: -2,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Zirconium',
        modernSymbol: 'Zr',
        modernName: 'Zirconium',
        Z: 40,
        position: -1,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Xenon',
        modernSymbol: 'Xe',
        modernName: 'Xenon',
        Z: 54,
        position: 0,
        side: 'inertGas',
        status: 'known',
      },
      {
        russellName: 'Antimony',
        modernSymbol: 'Sb',
        modernName: 'Antimony',
        Z: 51,
        position: 1,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Tellurium',
        modernSymbol: 'Te',
        modernName: 'Tellurium',
        Z: 52,
        position: 2,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Iodine',
        modernSymbol: 'I',
        modernName: 'Iodine',
        Z: 53,
        position: 3,
        side: 'radiation',
        status: 'known',
      },
    ],
  },

  // Octave 9: XENON octave (Cs through Bi, plus predicted Np and Pu)
  {
    number: 9,
    inertGasName: 'Radon',
    elements: [
      {
        russellName: 'Caesium',
        modernSymbol: 'Cs',
        modernName: 'Caesium',
        Z: 55,
        position: -4,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Barium',
        modernSymbol: 'Ba',
        modernName: 'Barium',
        Z: 56,
        position: -3,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Lanthanum',
        modernSymbol: 'La',
        modernName: 'Lanthanum',
        Z: 57,
        position: -2,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Cerium',
        modernSymbol: 'Ce',
        modernName: 'Cerium',
        Z: 58,
        position: -1,
        side: 'generation',
        status: 'known',
      },
      {
        russellName: 'Radon',
        modernSymbol: 'Rn',
        modernName: 'Radon',
        Z: 86,
        position: 0,
        side: 'inertGas',
        status: 'known',
      },
      {
        russellName: 'Thallium',
        modernSymbol: 'Tl',
        modernName: 'Thallium',
        Z: 81,
        position: 1,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Lead',
        modernSymbol: 'Pb',
        modernName: 'Lead',
        Z: 82,
        position: 2,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Bismuth',
        modernSymbol: 'Bi',
        modernName: 'Bismuth',
        Z: 83,
        position: 3,
        side: 'radiation',
        status: 'known',
      },
      {
        russellName: 'Neptunium',
        modernSymbol: 'Np',
        modernName: 'Neptunium',
        Z: 93,
        position: 4,
        side: 'radiation',
        status: 'predicted',
        note: 'russellChart.notes.neptuniumPrediction',
      },
      {
        russellName: 'Plutonium',
        modernSymbol: 'Pu',
        modernName: 'Plutonium',
        Z: 94,
        position: -4,
        side: 'generation',
        status: 'predicted',
        note: 'russellChart.notes.plutoniumPrediction',
      },
    ],
  },

  // Octave 10: OMEGANON (hypothetical — beyond known matter)
  {
    number: 10,
    inertGasName: 'Omeganon',
    elements: [
      {
        russellName: 'Tommon',
        position: -4,
        side: 'generation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranicInSystem',
      },
      {
        russellName: 'Whytton',
        position: -3,
        side: 'generation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
      {
        russellName: 'Alphingon',
        position: -2,
        side: 'generation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
      {
        russellName: 'Georgicon',
        position: -1,
        side: 'generation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
      {
        russellName: 'Omeganon',
        position: 0,
        side: 'inertGas',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalFinalInertGas',
      },
      {
        russellName: 'Victoron',
        position: 1,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
      {
        russellName: 'Jipton',
        position: 2,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
      {
        russellName: 'Blacton',
        position: 3,
        side: 'radiation',
        status: 'hypothetical',
        note: 'russellChart.notes.hypotheticalTransUranic',
      },
    ],
  },
]

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get all Russell elements as a flat array */
export function getAllRussellElements(): RussellElement[] {
  return RUSSELL_OCTAVES.flatMap(o => o.elements)
}

/** Find a Russell element by its modern symbol */
export function getRussellElementBySymbol(symbol: string): RussellElement | undefined {
  return getAllRussellElements().find(e => e.modernSymbol === symbol)
}

/** Get all elements Russell predicted before their official discovery */
export function getPredictedElements(): RussellElement[] {
  return getAllRussellElements().filter(e => e.status === 'predicted')
}

/** Column header labels for positions -4 to +4 */
export const POSITION_LABELS = [
  'Gen 4',  // -4
  'Gen 3',  // -3
  'Gen 2',  // -2
  'Gen 1',  // -1
  'Inert Gas', // 0
  'Rad 1',  // +1
  'Rad 2',  // +2
  'Rad 3',  // +3
  'Rad 4',  // +4
] as const
