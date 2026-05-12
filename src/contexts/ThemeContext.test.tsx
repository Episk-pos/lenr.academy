import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

// Mock matchMedia for jsdom (which doesn't provide it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(),
})

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  function renderThemeHook() {
    return renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    })
  }

  describe('ThemeProvider', () => {
    it('defaults to light theme when no saved preference or system preference', () => {
      const { result } = renderThemeHook()
      expect(result.current.theme).toBe('light')
    })

    it('uses saved theme from localStorage', () => {
      localStorage.setItem('theme', 'dark')
      const { result } = renderThemeHook()
      expect(result.current.theme).toBe('dark')
    })

    it('falls back to system dark preference when no localStorage', () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      const { result } = renderThemeHook()
      expect(result.current.theme).toBe('dark')
    })

    it('applies theme class to document element', () => {
      localStorage.setItem('theme', 'dark')
      renderThemeHook()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('saves theme to localStorage on change', () => {
      const { result } = renderThemeHook()
      expect(localStorage.getItem('theme')).toBe('light')

      act(() => {
        result.current.toggleTheme()
      })

      expect(localStorage.getItem('theme')).toBe('dark')
    })
  })

  describe('toggleTheme', () => {
    it('toggles from light to dark', () => {
      const { result } = renderThemeHook()
      expect(result.current.theme).toBe('light')

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('dark')
    })

    it('toggles from dark to light', () => {
      localStorage.setItem('theme', 'dark')

      const { result } = renderThemeHook()
      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('light')
    })

    it('updates document classes when toggling', () => {
      const { result } = renderThemeHook()
      expect(document.documentElement.classList.contains('light')).toBe(true)

      act(() => {
        result.current.toggleTheme()
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })
  })

  describe('useTheme', () => {
    it('throws when used outside ThemeProvider', () => {
      expect(() => {
        renderHook(() => useTheme())
      }).toThrow('useTheme must be used within a ThemeProvider')
    })
  })
})
