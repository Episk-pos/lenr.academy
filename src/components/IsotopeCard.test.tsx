import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IsotopeCard from './IsotopeCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('IsotopeCard', () => {
  it('renders full-data nuclide with boson badge and stable badge', () => {
    render(<IsotopeCard E="Fe" A={56} Z={26} nBorF="b" stable />)
    const card = screen.getByTestId('isotope-card')
    expect(card).toHaveAttribute('data-nuclide', 'Fe-56')
    expect(card).toHaveTextContent('Fe-56')
    expect(card).toHaveTextContent('Z=26')
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('elements.stableNuclide')).toBeInTheDocument()
  })

  it('renders fermion badge and omits stable badge when unstable', () => {
    render(<IsotopeCard E="Co" A={59} Z={27} nBorF="f" />)
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.queryByText('elements.stableNuclide')).not.toBeInTheDocument()
  })

  it('renders limited-data variant with decay mode and half-life', () => {
    render(<IsotopeCard E="Tc" A={99} Z={43} limitedData={{ decayMode: 'B-', halfLife: '2.1e+5y' }} />)
    const card = screen.getByTestId('isotope-card')
    expect(card).toHaveTextContent('B-')
    expect(card).toHaveTextContent('2.1e+5y')
    expect(card.className).toContain('bg-amber-50')
  })

  it('shows a half-life pill on full-data radioactive nuclides (e.g. T-3)', () => {
    const { rerender } = render(<IsotopeCard E="T" A={3} Z={1} nBorF="f" />)
    expect(screen.queryByTestId('isotope-card-half-life')).not.toBeInTheDocument()
    rerender(<IsotopeCard E="T" A={3} Z={1} nBorF="f" radioactive halfLife="12.33Y" />)
    expect(screen.getByTestId('isotope-card-radioactive')).toBeInTheDocument()
    expect(screen.getByTestId('isotope-card-half-life')).toHaveTextContent('12.33Y')
  })

  it('shows radioactive badge only when requested', () => {
    const { rerender } = render(<IsotopeCard E="Co" A={60} Z={27} nBorF="b" />)
    expect(screen.queryByTestId('isotope-card-radioactive')).not.toBeInTheDocument()
    rerender(<IsotopeCard E="Co" A={60} Z={27} nBorF="b" radioactive />)
    expect(screen.getByTestId('isotope-card-radioactive')).toBeInTheDocument()
  })

  it('reflects selected, highlighted and dimmed states', () => {
    const { rerender } = render(<IsotopeCard E="Fe" A={56} Z={26} nBorF="b" selected />)
    let card = screen.getByTestId('isotope-card')
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card.className).toContain('bg-blue-500')

    rerender(<IsotopeCard E="Fe" A={56} Z={26} nBorF="b" highlighted />)
    card = screen.getByTestId('isotope-card')
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(card.className).toContain('bg-blue-50')

    rerender(<IsotopeCard E="Fe" A={56} Z={26} nBorF="b" dimmed />)
    expect(screen.getByTestId('isotope-card').className).toContain('opacity-50')
  })

  it('fires click and hover handlers', () => {
    const onClick = vi.fn()
    const onMouseEnter = vi.fn()
    const onMouseLeave = vi.fn()
    render(<IsotopeCard E="Fe" A={56} Z={26} nBorF="b" onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />)
    const card = screen.getByTestId('isotope-card')
    fireEvent.mouseEnter(card)
    fireEvent.click(card)
    fireEvent.mouseLeave(card)
    expect(onMouseEnter).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onMouseLeave).toHaveBeenCalledTimes(1)
  })
})
