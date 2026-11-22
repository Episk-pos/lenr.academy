import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'

// English is bundled (it is the fallback, so it must be available synchronously).
// Every other locale is a separate chunk, fetched only when that language is used.
import en from './locales/en.json'

export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  sv: { name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  da: { name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  nb: { name: 'Norwegian (Bokmål)', nativeName: 'Norsk bokmål', flag: '🇳🇴' },
  fi: { name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  hu: { name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  sw: { name: 'Swahili', nativeName: 'Kiswahili', flag: '🇹🇿' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  fa: { name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  ur: { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
} as const

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// Map browser languages to our supported languages
const languageMap: Record<string, SupportedLanguage> = {
  'en': 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'ru': 'ru',
  'ru-RU': 'ru',
  'ja': 'ja',
  'ja-JP': 'ja',
  'zh': 'zh',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  'de': 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  'fr': 'fr',
  'fr-FR': 'fr',
  'fr-CA': 'fr',
  'fr-BE': 'fr',
  'fr-CH': 'fr',
  'es': 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
  'it': 'it',
  'it-IT': 'it',
  'it-CH': 'it',
  'pt': 'pt',
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  'uk': 'uk',
  'uk-UA': 'uk',
  'pl': 'pl',
  'pl-PL': 'pl',
  'ko': 'ko',
  'ko-KR': 'ko',
  'hi': 'hi',
  'hi-IN': 'hi',
  'ar': 'ar',
  'ar-SA': 'ar',
  'ar-EG': 'ar',
  'ar-AE': 'ar',
  'ar-MA': 'ar',
  'ar-DZ': 'ar',
  'ar-IQ': 'ar',
  'ar-JO': 'ar',
  'ar-KW': 'ar',
  'ar-LB': 'ar',
  'ar-QA': 'ar',
  'ar-TN': 'ar',
  'nl': 'nl',
  'nl-NL': 'nl',
  'nl-BE': 'nl',
  'sv': 'sv',
  'sv-SE': 'sv',
  'sv-FI': 'sv',
  'da': 'da',
  'da-DK': 'da',
  'nb': 'nb',
  'nb-NO': 'nb',
  'nn': 'nb',
  'nn-NO': 'nb',
  'no': 'nb',
  'no-NO': 'nb',
  'fi': 'fi',
  'fi-FI': 'fi',
  'cs': 'cs',
  'cs-CZ': 'cs',
  'hu': 'hu',
  'hu-HU': 'hu',
  'tr': 'tr',
  'tr-TR': 'tr',
  'id': 'id',
  'id-ID': 'id',
  'vi': 'vi',
  'vi-VN': 'vi',
  'sw': 'sw',
  'sw-KE': 'sw',
  'sw-TZ': 'sw',
  'bn': 'bn',
  'bn-BD': 'bn',
  'bn-IN': 'bn',
  'th': 'th',
  'th-TH': 'th',
  'fa': 'fa',
  'fa-IR': 'fa',
  'fa-AF': 'fa',
  'ur': 'ur',
  'ur-PK': 'ur',
  'ur-IN': 'ur',
}

// Keep <html lang> and <html dir> in sync with the active language (screen
// readers, hyphenation, script-appropriate font fallback, and right-to-left
// layout for Arabic, Persian and Urdu; i18next's dir() knows all three). Registered before init so the initial languageChanged
// event emitted during init is captured too.
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined' && lng) {
    document.documentElement.lang = lng
    document.documentElement.dir = i18n.dir(lng) === 'rtl' ? 'rtl' : 'ltr'
  }
})

// Region-coded browser languages (pt-BR, zh-TW, ko-KR, ...) need no explicit
// mapping: with supportedLngs set, i18next's getBestMatchFromCodes falls back to
// the language-only code (see detection.test.ts). It cannot map one language
// code to a different one, though: Norwegian browsers report `no` or `nn`
// (Nynorsk) as often as `nb`, so detected codes go through languageMap first
// (convertDetectedLanguage) to land on our Bokmål translation.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((lng: string) => import(`./locales/${lng}.json`)))

/**
 * Resolves once the detected language's bundle has loaded. main.tsx waits for
 * it before the first render, so non-English users never see English or raw keys.
 */
export const i18nReady = i18n
  .init({
    resources: { en: { translation: en } },
    // Load languages missing from `resources` through the resourcesToBackend loader
    partialBundledLanguages: true,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[],

    // Language detection configuration
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lenr-language-preference',
      caches: ['localStorage'],
      excludeCacheFor: ['cimode'],
      convertDetectedLanguage: (lng: string) => languageMap[lng] ?? lng,
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false, // main.tsx awaits i18nReady instead
    },
  })

// Helper function to get mapped language
export function getMappedLanguage(browserLang: string): SupportedLanguage {
  return languageMap[browserLang] || DEFAULT_LANGUAGE
}

export default i18n
