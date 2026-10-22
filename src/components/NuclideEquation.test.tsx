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
import { toLatex, parseMechanism } from './nuclideEquation.utils'
import { DOCUMENTED_TRANSMUTATIONS } from '../data/documentedTransmutations'

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

describe('parseMechanism', () => {
  it('extracts an equation in the middle of prose (Vysotskii Mn → Fe, no colon)', () => {
    expect(
      parseMechanism('Net reaction proposed as $55Mn + d → 57Fe$ via biologically-mediated low-energy fusion')
    ).toEqual([
      { type: 'text', value: 'Net reaction proposed as ' },
      { type: 'math', value: '55Mn + d → 57Fe' },
      { type: 'text', value: ' via biologically-mediated low-energy fusion' },
    ])
  })

  it('extracts an equation at the start of the string (SPAWAR D + D)', () => {
    expect(parseMechanism('$D + D → T + p$ reported; anomalous')).toEqual([
      { type: 'math', value: 'D + D → T + p' },
      { type: 'text', value: ' reported; anomalous' },
    ])
  })

  it('handles an equation after a colon at the end of the string', () => {
    expect(parseMechanism('Sequential alpha-capture: $133Cs + 2 × 4He → 141Pr$')).toEqual([
      { type: 'text', value: 'Sequential alpha-capture: ' },
      { type: 'math', value: '133Cs + 2 × 4He → 141Pr' },
    ])
  })

  it('treats strings without delimiters as plain prose, even with a colon', () => {
    expect(parseMechanism('Mechanism: unresolved')).toEqual([
      { type: 'text', value: 'Mechanism: unresolved' },
    ])
  })

  it('keeps an unmatched trailing $ as literal text', () => {
    expect(parseMechanism('Cost $5 only')).toEqual([{ type: 'text', value: 'Cost $5 only' }])
  })
})

describe('documented transmutation mechanisms', () => {
  it('mark every equation explicitly so the Mn→Fe and D+D mechanisms render as math', () => {
    const byId = Object.fromEntries(DOCUMENTED_TRANSMUTATIONS.map(e => [e.id, e]))
    const math = (id: string) =>
      parseMechanism(byId[id].hypothesizedMechanism ?? '').filter(s => s.type === 'math').map(s => s.value)
    expect(math('vysotskii-mn-fe')).toEqual(['55Mn + d → 57Fe'])
    expect(math('spawar-tritium')).toEqual(['D + D → T + p'])
    expect(math('iwamura-cs-pr')).toEqual(['133Cs + 2 × 4He → 141Pr'])
  })

  it('keep the same math segments in every locale as in the source data', () => {
    const locales = import.meta.glob('../i18n/locales/*.json', { eager: true }) as Record<
      string,
      { default: { transmutations: { entries: Record<string, { hypothesizedMechanism?: string }> } } }
    >
    const mathOf = (s: string) => parseMechanism(s).filter(seg => seg.type === 'math').map(seg => seg.value)
    expect(Object.keys(locales).length).toBe(13)
    for (const [file, mod] of Object.entries(locales)) {
      for (const entry of DOCUMENTED_TRANSMUTATIONS) {
        if (!entry.hypothesizedMechanism) continue
        const translated = mod.default.transmutations.entries[entry.id]?.hypothesizedMechanism
        expect(translated, `${file} ${entry.id}`).toBeDefined()
        expect(mathOf(translated!), `${file} ${entry.id}`).toEqual(mathOf(entry.hypothesizedMechanism))
      }
    }
  })
})
