import { describe, it, expect } from 'vitest'
import { heatmapColor, heatmapGradient } from './heatmapColor'

describe('heatmapColor', () => {
  it('returns pure blue-600 / green-600 at full intensity in light mode', () => {
    expect(heatmapColor(0, 1, false)).toBe('rgb(37, 99, 235)')
    expect(heatmapColor(1, 1, false)).toBe('rgb(22, 163, 74)')
  })

  it('fades to white at zero intensity in light mode', () => {
    expect(heatmapColor(1, 0, false)).toBe('rgb(255, 255, 255)')
  })

  it('darkens and adds alpha in dark mode', () => {
    expect(heatmapColor(1, 1, true)).toBe('rgba(13, 98, 44, 0.8)')
    expect(heatmapColor(0, 0, true)).toBe('rgba(22, 59, 141, 0.3)')
  })

  it('clamps out-of-range inputs', () => {
    expect(heatmapColor(2, 5, false)).toBe(heatmapColor(1, 1, false))
    expect(heatmapColor(-1, -1, false)).toBe(heatmapColor(0, 0, false))
  })
})

describe('heatmapGradient', () => {
  it('builds a linear-gradient from the stop colours', () => {
    const g = heatmapGradient([{ ratio: 0, intensity: 1 }, { ratio: 1, intensity: 1 }], false)
    expect(g).toBe('linear-gradient(to right, rgb(37, 99, 235), rgb(22, 163, 74))')
  })
})
