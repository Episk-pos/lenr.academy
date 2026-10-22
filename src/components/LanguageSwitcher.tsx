import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import type { SupportedLanguage } from '../i18n/config'

interface LanguageSwitcherProps {
  className?: string
  compact?: boolean
  position?: 'above' | 'below'
}

export default function LanguageSwitcher({ className = '', compact = false, position = 'above' }: LanguageSwitcherProps) {
  const { t } = useTranslation()
  const { language, setLanguage, supportedLanguages, markLanguageSelected } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      if (position === 'below') {
        // Mobile header: position below button, aligned to right edge
        setDropdownPosition({
          top: rect.bottom + 8, // Position below button with small gap
          left: rect.right - Math.max(rect.width, 200), // Align right edges
          width: Math.max(rect.width, 200) // Minimum width of 200px
        })
      } else {
        // Desktop sidebar: position above button, left-aligned
        setDropdownPosition({
          top: rect.top - 8, // Position above button with small gap
          left: rect.left,
          width: Math.max(rect.width, 200) // Minimum width of 200px
        })
      }
    }
  }, [isOpen, position])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang)
    markLanguageSelected()
    setIsOpen(false)
  }

  const currentLanguage = supportedLanguages[language]

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] max-h-[calc(100vh-200px)] overflow-y-auto"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        // Desktop sidebar (position='above'): translate up to appear above button
        // Mobile header (position='below'): no transform needed, already positioned below
        transform: position === 'below' ? undefined : 'translateY(-100%)'
      }}
    >
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
          {t('language.selectLanguage')}
        </div>
        <div className="space-y-1">
          {Object.entries(supportedLanguages).map(([code, info]) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code as SupportedLanguage)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                language === code
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{info.flag}</span>
                <div className="text-start">
                  <div className="text-sm font-medium">
                    {info.nativeName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {info.name}
                  </div>
                </div>
              </div>
              {language === code && (
                <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          compact ? '' : 'w-full'
        }`}
        aria-label={t('language.changeLanguage')}
        title={compact ? t('language.changeLanguage') : undefined}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!compact && (
            <>
              <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
              <span className="sm:hidden">{currentLanguage.flag}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </div>
      </button>

      {/* Dropdown menu - rendered via portal to escape sidebar overflow */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  )
}
