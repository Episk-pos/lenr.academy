import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ResultNuclidesByElement from './ResultNuclidesByElement'
import { HoverHighlightContext, createHoverHighlightStore } from '../contexts/HoverHighlightContext'
import type { Nuclide } from '../types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts
        ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})`
        : key,
  }),
}))

const nuc = (E: string, Z: number, A: number, extra: Partial<Nuclide> = {}) =>
  ({ id: Z * 1000 + A, E, Z, A, nBorF: A % 2 === 0 ? 'b' : 'f', ...extra } as Nuclide)

// Deliberately unsorted; includes H and D sharing Z=1
const nuclides = [
  nuc('Co', 27, 60),
  nuc('Fe', 26, 58, { logHalfLife: 20 }),
  nuc('D', 1, 2),
  nuc('Fe', 26, 56, { logHalfLife: 20 }),
  nuc('H', 1, 1),
  nuc('Co', 27, 59),
]

type Props = React.ComponentProps<typeof ResultNuclidesByElement>

function renderSection(overrides: Partial<Props> = {}) {
  const props: Props = {
    nuclides,
    radioactiveNuclides: new Set(['27-60']),
    pinnedElement: null,
    highlightedNuclide: null,
    pinnedNuclide: false,
    onElementSelect: vi.fn(),
    onNuclideHover: vi.fn(),
    onNuclideSelect: vi.fn(),
    ...overrides,
  }
  const utils = render(<ResultNuclidesByElement {...props} />)
  return { props, ...utils }
}

const cardIds = () => screen.getAllByTestId('isotope-card').map(c => c.getAttribute('data-nuclide'))
const chip = (E: string) =>
  screen.getAllByTestId('element-chip').find(c => c.getAttribute('data-element') === E)!

describe('ResultNuclidesByElement', () => {
  it('renders nothing when there are no nuclides', () => {
    const { container } = renderSection({ nuclides: [] })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the heading with nuclide and element counts', () => {
    renderSection()
    expect(screen.getByTestId('result-nuclides-count')).toHaveTextContent(
      'nuclides=reactions.nuclideCount(count=6),elements=reactions.elementCount(count=4)'
    )
  })

  it('renders element chips sorted by Z with nuclide counts', () => {
    renderSection()
    const chips = screen.getAllByTestId('element-chip')
    expect(chips.map(c => c.getAttribute('data-element'))).toEqual(['H', 'D', 'Fe', 'Co'])
    expect(chip('Fe')).toHaveTextContent('Fe·2')
    expect(chip('Co')).toHaveTextContent('Co·2')
  })

  it('defaults to the first element without pinning it', () => {
    renderSection()
    expect(cardIds()).toEqual(['H-1'])
    for (const c of screen.getAllByTestId('element-chip')) {
      expect(c).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByText('reactions.elementChipHint')).toBeInTheDocument()
  })

  it('shows the pinned element nuclides sorted by A and marks its chip pressed', () => {
    renderSection({ pinnedElement: 'Fe' })
    expect(cardIds()).toEqual(['Fe-56', 'Fe-58'])
    expect(chip('Fe')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('reactions.elementChipHint')).not.toBeInTheDocument()
    expect(screen.getByTestId('result-nuclides-element-heading')).toHaveTextContent(
      'reactions.nuclidesOfElement(element=Fe,filtered=2,total=6)'
    )
  })

  it('auto-selects the element of a pinned nuclide', () => {
    renderSection({ highlightedNuclide: 'Co-60', pinnedNuclide: true })
    expect(cardIds()).toEqual(['Co-59', 'Co-60'])
    const card = screen.getAllByTestId('isotope-card').find(c => c.getAttribute('data-nuclide') === 'Co-60')!
    expect(card).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not switch element when a nuclide is only hovered', () => {
    renderSection({ highlightedNuclide: 'Co-60', pinnedNuclide: false })
    expect(cardIds()).toEqual(['H-1'])
  })

  it('calls onElementSelect when a chip is clicked (pin and unpin)', () => {
    const { props, rerender } = renderSection()
    fireEvent.click(chip('Co'))
    expect(props.onElementSelect).toHaveBeenCalledWith('Co')
    rerender(<ResultNuclidesByElement {...props} pinnedElement="Co" />)
    fireEvent.click(chip('Co'))
    expect(props.onElementSelect).toHaveBeenLastCalledWith('Co')
  })

  it('selects and hovers nuclide cards', () => {
    const { props } = renderSection({ pinnedElement: 'Fe' })
    const card = screen.getAllByTestId('isotope-card')[1]
    fireEvent.mouseEnter(card)
    expect(props.onNuclideHover).toHaveBeenCalledWith('Fe-58')
    fireEvent.mouseLeave(card)
    expect(props.onNuclideHover).toHaveBeenLastCalledWith(null)
    fireEvent.click(card)
    expect(props.onNuclideSelect).toHaveBeenCalledWith(expect.objectContaining({ E: 'Fe', A: 58 }))
  })

  it('does not report hover while a nuclide is pinned', () => {
    const { props } = renderSection({ pinnedElement: 'Fe', highlightedNuclide: 'Fe-56', pinnedNuclide: true })
    fireEvent.mouseEnter(screen.getAllByTestId('isotope-card')[1])
    expect(props.onNuclideHover).not.toHaveBeenCalled()
  })

  it('shows radioactive badge for radioactive nuclides', () => {
    renderSection({ pinnedElement: 'Co' })
    const [co59, co60] = screen.getAllByTestId('isotope-card')
    expect(within(co59).queryByTestId('isotope-card-radioactive')).not.toBeInTheDocument()
    expect(within(co60).getByTestId('isotope-card-radioactive')).toBeInTheDocument()
  })

  it('chips are keyboard-focusable buttons', () => {
    renderSection()
    const c = chip('Fe')
    expect(c.tagName).toBe('BUTTON')
    c.focus()
    expect(c).toHaveFocus()
  })

  describe('with a HoverHighlightContext store', () => {
    const cardFor = (id: string) =>
      screen.getAllByTestId('isotope-card').find(c => c.getAttribute('data-nuclide') === id)!

    function renderWithStore(overrides: Partial<Props> = {}) {
      const store = createHoverHighlightStore()
      const props: Props = {
        nuclides,
        radioactiveNuclides: new Set(),
        pinnedElement: 'Fe',
        highlightedNuclide: null,
        pinnedNuclide: false,
        onElementSelect: vi.fn(),
        onNuclideSelect: vi.fn(),
        ...overrides,
      }
      render(
        <HoverHighlightContext.Provider value={store}>
          <ResultNuclidesByElement {...props} />
        </HoverHighlightContext.Provider>
      )
      return { store, props }
    }

    it('writes hover to the store and highlights/dims cards from it', () => {
      const { store } = renderWithStore()
      fireEvent.mouseEnter(cardFor('Fe-58'))
      expect(store.getState().nuclide).toBe('Fe-58')
      expect(cardFor('Fe-58').className).toContain('border-blue-400')
      expect(cardFor('Fe-58')).toHaveAttribute('aria-pressed', 'false')
      expect(cardFor('Fe-56').className).toContain('opacity-50')

      fireEvent.mouseLeave(cardFor('Fe-58'))
      expect(store.getState().nuclide).toBeNull()
      expect(cardFor('Fe-56').className).not.toContain('opacity-50')
    })

    it('ignores hover while a nuclide is pinned and shows the pinned card as selected', () => {
      const { store } = renderWithStore({ highlightedNuclide: 'Fe-56', pinnedNuclide: true })
      fireEvent.mouseEnter(cardFor('Fe-58'))
      expect(store.getState().nuclide).toBeNull()
      expect(cardFor('Fe-56')).toHaveAttribute('aria-pressed', 'true')
      expect(cardFor('Fe-58').className).toContain('opacity-50')
    })
  })
})
