import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LanguageProvider, useLanguage } from './LanguageContext'

// Mock i18n config to prevent initialization side effects
vi.mock('../i18n/config', () => ({
  SUPPORTED_LANGUAGES: {
    en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
    ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  },
  DEFAULT_LANGUAGE: 'en',
}))

// Mock react-i18next
const mockChangeLanguage = vi.fn()
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
  }),
}))

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear()
    mockChangeLanguage.mockClear()
  })

  function renderLanguageHook() {
    return renderHook(() => useLanguage(), {
      wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
    })
  }

  describe('LanguageProvider', () => {
    it('provides current language', () => {
      const { result } = renderLanguageHook()
      expect(result.current.language).toBe('en')
    })

    it('provides supported languages list', () => {
      const { result } = renderLanguageHook()
      const langs = Object.keys(result.current.supportedLanguages)
      expect(langs).toContain('en')
      expect(langs).toContain('ru')
      expect(langs).toContain('ja')
      expect(langs).toContain('zh')
      expect(langs).toContain('de')
      expect(langs).toContain('fr')
      expect(langs).toContain('es')
    })

    it('detects first visit when no language selected key exists', () => {
      const { result } = renderLanguageHook()
      expect(result.current.isFirstVisit).toBe(true)
    })

    it('is not first visit when language was previously selected', () => {
      localStorage.setItem('lenr-language-selected', 'true')
      const { result } = renderLanguageHook()
      expect(result.current.isFirstVisit).toBe(false)
    })
  })

  describe('setLanguage', () => {
    it('calls i18n.changeLanguage with new language', () => {
      const { result } = renderLanguageHook()

      act(() => {
        result.current.setLanguage('de')
      })

      expect(mockChangeLanguage).toHaveBeenCalledWith('de')
    })

    it('saves language preference to localStorage', () => {
      const { result } = renderLanguageHook()

      act(() => {
        result.current.setLanguage('fr')
      })

      expect(localStorage.getItem('lenr-language-preference')).toBe('fr')
    })
  })

  describe('markLanguageSelected', () => {
    it('sets isFirstVisit to false', () => {
      const { result } = renderLanguageHook()
      expect(result.current.isFirstVisit).toBe(true)

      act(() => {
        result.current.markLanguageSelected()
      })

      expect(result.current.isFirstVisit).toBe(false)
    })

    it('persists selection to localStorage', () => {
      const { result } = renderLanguageHook()

      act(() => {
        result.current.markLanguageSelected()
      })

      expect(localStorage.getItem('lenr-language-selected')).toBe('true')
    })
  })

  describe('useLanguage', () => {
    it('throws when used outside LanguageProvider', () => {
      expect(() => {
        renderHook(() => useLanguage())
      }).toThrow('useLanguage must be used within LanguageProvider')
    })
  })
})
