/**
 * Comprehensive radiation type and decay mode information
 * Used across the application for tooltips, legends, and educational content
 */
export const RADIATION_TYPE_INFO: Record<string, { name: string; description: string; url: string; category: string }> = {
  // Primary decay modes
  'A': { name: 'Alpha particle', description: 'He-4 nucleus', url: 'https://en.wikipedia.org/wiki/Alpha_particle', category: 'primary' },
  'B-': { name: 'Beta minus', description: 'electron emission', url: 'https://en.wikipedia.org/wiki/Beta_decay', category: 'primary' },
  'B+': { name: 'Beta plus', description: 'positron emission', url: 'https://en.wikipedia.org/wiki/Positron_emission', category: 'primary' },
  'B': { name: 'Beta decay', description: 'unspecified sign', url: 'https://en.wikipedia.org/wiki/Beta_decay', category: 'primary' },
  'EC': { name: 'Electron capture', description: 'orbital electron absorbed', url: 'https://en.wikipedia.org/wiki/Electron_capture', category: 'primary' },
  'IT': { name: 'Isomeric transition', description: 'excited state decay', url: 'https://en.wikipedia.org/wiki/Isomeric_transition', category: 'primary' },

  // Gamma radiation
  'G': { name: 'Gamma ray', description: 'high-energy photon', url: 'https://en.wikipedia.org/wiki/Gamma_ray', category: 'gamma' },
  'G-AN': { name: 'Annihilation gamma', description: 'positron annihilation', url: 'https://en.wikipedia.org/wiki/Electron%E2%80%93positron_annihilation', category: 'gamma' },

  // X-rays
  'G-X-K': { name: 'K-shell X-ray', description: 'K shell transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KA1': { name: 'Kα1 X-ray', description: 'K shell α1 transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KA2': { name: 'Kα2 X-ray', description: 'K shell α2 transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KB': { name: 'Kβ X-ray', description: 'K shell β transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-L': { name: 'L-shell X-ray', description: 'L shell transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },

  // Conversion electrons
  'E-CE-K': { name: 'K-shell conversion electron', description: 'internal conversion from K shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-L': { name: 'L-shell conversion electron', description: 'internal conversion from L shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-M': { name: 'M-shell conversion electron', description: 'internal conversion from M shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-M+': { name: 'M+ shell conversion electron', description: 'internal conversion from M+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-MN+': { name: 'MN+ shell conversion electron', description: 'internal conversion from MN+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-N+': { name: 'N+ shell conversion electron', description: 'internal conversion from N+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },

  // Auger electrons
  'E-AU-K': { name: 'K-shell Auger electron', description: 'atomic de-excitation from K shell', url: 'https://en.wikipedia.org/wiki/Auger_effect', category: 'electron' },
  'E-AU-L': { name: 'L-shell Auger electron', description: 'atomic de-excitation from L shell', url: 'https://en.wikipedia.org/wiki/Auger_effect', category: 'electron' },
}
