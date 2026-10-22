import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Transmutations from './Transmutations'

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: null, isLoading: false }),
}))

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <Transmutations />
    </MemoryRouter>
  )
}

describe('Transmutations mechanism rendering', () => {
  it('renders the Mn-55 → Fe-57 mechanism equation with KaTeX (no colon in the text)', () => {
    renderPage()
    const dd = screen.getByTestId('mechanism-vysotskii-mn-fe')
    expect(dd.querySelector('.katex')).not.toBeNull()
    expect(dd.textContent).toContain('Net reaction proposed as')
    expect(dd.textContent).toContain('via biologically-mediated low-energy fusion')
    // Delimiters are markup only and never shown
    expect(dd.textContent).not.toContain('$')
  })

  it('renders the D + D mechanism equation with KaTeX when it starts the sentence', () => {
    renderPage()
    const dd = screen.getByTestId('mechanism-spawar-tritium')
    expect(dd.querySelector('.katex')).not.toBeNull()
    expect(dd.textContent).toContain('reported; not strictly elemental transmutation')
  })

  it('renders prose-only mechanisms without KaTeX', () => {
    renderPage()
    const dd = screen.getByTestId('mechanism-vysotskii-cs-ba')
    expect(dd.querySelector('.katex')).toBeNull()
  })

  it('shows where pathway results will appear next to the Find pathways button', () => {
    renderPage()
    expect(screen.getByTestId('pathway-hint-vysotskii-mn-fe')).toHaveTextContent(
      'Candidate pathways from the Parkhomov tables appear below this card.'
    )
  })
})
