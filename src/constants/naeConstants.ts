/**
 * NAE (Nuclear Active Environment) Constants
 *
 * Data for Muller Resonance NAE lattice predictions.
 * Combines Frithjof Muller's distance-resonance equation (L = Z × C × 2^N)
 * with Edmund Storms' NAE model (~1 nm gap size).
 *
 * Speed of sound values from CRC Handbook of Chemistry and Physics.
 * LENR-active elements from published experimental literature.
 */

// NAE gap range identified by Edmund Storms (JCMNS 41, 2026)
export const NAE_GAP_MIN = 0.5e-9 // 0.5 nm in meters
export const NAE_GAP_MAX = 2.0e-9 // 2.0 nm in meters
export const NAE_TARGET = 1.0e-9 // 1.0 nm center target

// Proton Compton wavelength
export const COMPTON_PROTON = 1.32141e-15 // meters

/**
 * Speed of sound in solid metals (m/s), longitudinal wave.
 * Used to estimate phonon frequencies from Muller resonance wavelengths.
 * Source: CRC Handbook, various experimental measurements.
 */
export const SPEED_OF_SOUND: Record<string, number> = {
  Li: 6000,
  Be: 12890,
  B: 16200,
  Na: 3200,
  Mg: 5770,
  Al: 6420,
  Si: 8433,
  K: 2000,
  Ca: 3810,
  Sc: 5360,
  Ti: 5090,
  V: 6070,
  Cr: 5940,
  Mn: 5150,
  Fe: 5130,
  Co: 4720,
  Ni: 4900,
  Cu: 3570,
  Zn: 3850,
  Ga: 2740,
  Ge: 5400,
  Sr: 3400,
  Y: 3300,
  Zr: 4650,
  Nb: 3480,
  Mo: 6250,
  Rh: 4700,
  Pd: 3070,
  Ag: 2600,
  Cd: 2310,
  In: 1215,
  Sn: 3320,
  Sb: 3420,
  Ba: 1620,
  La: 2475,
  Ce: 2100,
  Hf: 3010,
  Ta: 3400,
  W: 5220,
  Re: 4700,
  Os: 4940,
  Ir: 4825,
  Pt: 2680,
  Au: 2030,
  Tl: 818,
  Pb: 1260,
  Bi: 1790,
  Th: 2490,
  U: 3370,
}

/**
 * Elements with published LENR experimental reports.
 * Mapped to evidence strength and key references.
 */
export const KNOWN_LENR_ELEMENTS: Record<string, { strength: 'strong' | 'moderate' | 'weak'; reference: string }> = {
  Pd: { strength: 'strong', reference: 'Fleischmann-Pons 1989, Storms, Miles, McKubre' },
  Ni: { strength: 'strong', reference: 'Piantelli 1989, Focardi, Parkhomov, Rossi' },
  Pt: { strength: 'moderate', reference: 'Biberian, Storms electrode studies' },
  Ti: { strength: 'moderate', reference: 'Claytor (LANL) gas discharge, DeNinno (ENEA)' },
  W: { strength: 'weak', reference: 'Miley gas discharge, Karabut glow discharge' },
  Fe: { strength: 'weak', reference: 'Iwamura transmutation, biological transmutation claims' },
  Cu: { strength: 'weak', reference: 'Dash cathode deposits, surface transmutation reports' },
  Cr: { strength: 'weak', reference: 'Miley thin-film electrolysis' },
  Mn: { strength: 'weak', reference: 'Iwamura multilayer transmutation' },
  Zr: { strength: 'weak', reference: 'Lipson, gas-loading experiments' },
  Ag: { strength: 'weak', reference: 'Dash, surface analysis reports' },
}
