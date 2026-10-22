import { createContext, useContext, ReactNode, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../i18n/config'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/config'

interface LanguageContextType {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  supportedLanguages: typeof SUPPORTED_LANGUAGES
  isFirstVisit: boolean
  markLanguageSelected: () => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const LANGUAGE_PREFERENCE_KEY = 'lenr-language-preference'
const LANGUAGE_SELECTED_KEY = 'lenr-language-selected'

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation()
  // Read synchronously so the very first render already knows whether the
  // language prompt is pending (lets other first-visit prompts wait for it
  // without a flash).
  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem(LANGUAGE_SELECTED_KEY)
    } catch {
      return false
    }
  })

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, lang)
  }, [i18n])

  const markLanguageSelected = useCallback(() => {
    localStorage.setItem(LANGUAGE_SELECTED_KEY, 'true')
    setIsFirstVisit(false)
  }, [])

  const value: LanguageContextType = {
    language: (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isFirstVisit,
    markLanguageSelected,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
