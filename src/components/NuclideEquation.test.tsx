import { describe, it, expect, vi } from 'vitest'

// Mock KaTeX before importing the component — we test only the parser's LaTeX
// output, not the actual math rendering, which is KaTeX's responsibility.
vi.mock('katex', () => ({
  default: {
    renderToString: (latex: string) => `<span data-katex>${latex}</span>`,
  },
}))

import { render } from '@testing-library/react'
import NuclideEquation from './NuclideEquation'
import { toLatex } from './nuclideEquation.utils'

describe('toLatex', () => {
  it('converts a sequential alpha-capture equation (Iwamura Cs→Pr)', () => {
    expect(toLatex('133Cs + 2 × 4He → 141Pr')).toBe(
      '{}^{133}\\text{Cs} + 2 \\cdot {}^{4}\\text{He} \\to {}^{141}\\text{Pr}'
    )
  })

  it('converts a Vysotskii Mn+d equation with bare deuteron', () => {
    expect(toLatex('55Mn + d → 57Fe')).toBe(
      '{}^{55}\\text{Mn} + \\mathrm{d} \\to {}^{57}\\text{Fe}'
    )
  })

  it('converts an Iwamura Sr→Mo equation with cdot operator', () => {
    expect(toLatex('88Sr + 2 × 4He → 96Mo')).toBe(
      '{}^{88}\\text{Sr} + 2 \\cdot {}^{4}\\text{He} \\to {}^{96}\\text{Mo}'
    )
  })

  it('treats bare D/T/p/n as upright math symbols (SPAWAR D+D→T+p)', () => {
    expect(toLatex('D + D → T + p')).toBe(
      '\\mathrm{D} + \\mathrm{D} \\to \\mathrm{T} + \\mathrm{p}'
    )
  })

  it('handles ASCII -> arrow and a gamma in a p+n→d+γ reaction', () => {
    expect(toLatex('p + n -> d + γ')).toBe(
      '\\mathrm{p} + \\mathrm{n} \\to \\mathrm{d} + \\gamma'
    )
  })

  it('accepts ASCII * as a coefficient operator', () => {
    expect(toLatex('133Cs + 2 * 4He → 141Pr')).toBe(
      '{}^{133}\\text{Cs} + 2 \\cdot {}^{4}\\text{He} \\to {}^{141}\\text{Pr}'
    )
  })
})

describe('<NuclideEquation />', () => {
  it('renders an inline span with KaTeX HTML for an isotope equation', () => {
    const { container } = render(<NuclideEquation input="133Cs + 2 × 4He → 141Pr" />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.innerHTML).toContain('{}^{133}\\text{Cs}')
    expect(span!.innerHTML).toContain('\\to')
    expect(span!.innerHTML).toContain('{}^{141}\\text{Pr}')
  })

  it('renders a div in displayMode', () => {
    const { container } = render(
      <NuclideEquation input="55Mn + d → 57Fe" displayMode />
    )
    expect(container.querySelector('div')).not.toBeNull()
  })
})
