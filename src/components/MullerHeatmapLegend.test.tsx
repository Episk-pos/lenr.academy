import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockReactI18next } from '../test-utils/i18nMock'
import MullerHeatmapLegend from './MullerHeatmapLegend'
import { heatmapColor } from '../utils/heatmapColor'

vi.mock('react-i18next', () => mockReactI18next)

let mockTheme: 'light' | 'dark' = 'light'
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, toggleTheme: vi.fn() }),
}))

// jsdom normalises colours in inline styles; compare on the raw attribute
const styleOf = (el: HTMLElement) => el.getAttribute('style') ?? ''

describe('MullerHeatmapLegend', () => {
  beforeEach(() => {
    mockTheme = 'light'
  })

  it('renders the resonance scale with labels and the uncoloured note', () => {
    render(<MullerHeatmapLegend variant="resonance" />)
    expect(screen.getByTestId('muller-legend-resonance')).toBeInTheDocument()
    expect(screen.getByText('Weaker resonance')).toBeInTheDocument()
    expect(screen.getByText('Stronger resonance (lower mismatch)')).toBeInTheDocument()
    expect(screen.getByText(/no resonance match in the current view/)).toBeInTheDocument()
    expect(screen.queryByTestId('muller-legend-outside-swatch')).toBeNull()
  })

  it('uses the same colour scale as the periodic table (light theme)', () => {
    render(<MullerHeatmapLegend variant="resonance" />)
    const style = styleOf(screen.getByTestId('muller-legend-gradient'))
    expect(style).toContain('linear-gradient')
    // Strongest stop is the fully-saturated green used for best matches
    expect(style).toContain(heatmapColor(1, 1, false))
  })

  it('switches to dark-theme colours', () => {
    mockTheme = 'dark'
    render(<MullerHeatmapLegend variant="resonance" />)
    const style = styleOf(screen.getByTestId('muller-legend-gradient'))
    expect(style).toContain(heatmapColor(1, 1, true))
    expect(style).not.toContain(heatmapColor(1, 1, false))
  })

  it('shows an out-of-range swatch on the NAE variant', () => {
    render(<MullerHeatmapLegend variant="nae" />)
    expect(screen.getByText('Best NAE match')).toBeInTheDocument()
    expect(screen.getByText('Resonance outside the NAE range')).toBeInTheDocument()
    const swatch = screen.getByTestId('muller-legend-outside-swatch')
    expect(styleOf(swatch)).toContain(heatmapColor(0, 0.12, false))
  })
})
