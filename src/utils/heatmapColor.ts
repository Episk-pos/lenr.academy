/**
 * Colour scale shared by the PeriodicTable heatmap and any legend that
 * describes it, so the legend swatches always match the rendered cells.
 *
 * - `ratio` (0..1) picks the hue: 0 = blue-600, 1 = green-600 (teal in between).
 * - `intensity` (0..1) picks the strength: in light mode the colour is blended
 *   towards white as intensity drops; in dark mode it is darkened and given an
 *   alpha of 0.3 → 0.8.
 */

const BLUE = { r: 37, g: 99, b: 235 } // tailwind blue-600
const GREEN = { r: 22, g: 163, b: 74 } // tailwind green-600

function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t)
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function heatmapColor(ratio: number, intensity: number, isDarkMode: boolean): string {
  const r01 = clamp01(ratio)
  const i01 = clamp01(intensity)

  const baseR = lerp(BLUE.r, GREEN.r, r01)
  const baseG = lerp(BLUE.g, GREEN.g, r01)
  const baseB = lerp(BLUE.b, GREEN.b, r01)

  if (isDarkMode) {
    const r = Math.round(baseR * 0.6)
    const g = Math.round(baseG * 0.6)
    const b = Math.round(baseB * 0.6)
    const alpha = 0.3 + i01 * 0.5
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const fade = 1 - i01 ** 0.7
  return `rgb(${lerp(baseR, 255, fade)}, ${lerp(baseG, 255, fade)}, ${lerp(baseB, 255, fade)})`
}

/** Build a CSS linear-gradient across the given (ratio, intensity) stops. */
export function heatmapGradient(
  stops: Array<{ ratio: number; intensity: number }>,
  isDarkMode: boolean
): string {
  const colors = stops.map(s => heatmapColor(s.ratio, s.intensity, isDarkMode))
  return `linear-gradient(to right, ${colors.join(', ')})`
}
