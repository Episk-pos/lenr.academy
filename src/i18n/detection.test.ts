import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { i18n as I18n } from 'i18next';

/**
 * Exercises the real i18n config (LanguageDetector + supportedLngs) with
 * different browser language lists. Each case re-imports config.ts so
 * i18next initialises from scratch.
 */
async function initWithBrowserLanguages(languages: string[]): Promise<I18n> {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0]);
  vi.resetModules();
  const { default: i18n } = await import('./config');
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  return i18n;
}

describe('i18n browser language detection', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['uk-UA', 'uk'],
    ['ko-KR', 'ko'],
    ['hi-IN', 'hi'],
    ['ar-SA', 'ar'],
    ['ar-EG', 'ar'],
    ['it-CH', 'it'],
    ['pl-PL', 'pl'],
    ['zh-TW', 'zh'],
    ['zh-CN', 'zh'],
    ['ja-JP', 'ja'],
    ['de-AT', 'de'],
    ['en-US', 'en'],
  ])('maps region-coded browser language %s to %s', async (browserLang, expected) => {
    const i18n = await initWithBrowserLanguages([browserLang]);
    expect(i18n.language).toBe(expected);
    expect(i18n.resolvedLanguage).toBe(expected);
  });

  it('picks the first supported language from the browser preference list', async () => {
    const i18n = await initWithBrowserLanguages(['nl-NL', 'pt-BR', 'en-US']);
    expect(i18n.language).toBe('pt');
  });

  it('falls back to English for unsupported browser languages', async () => {
    const i18n = await initWithBrowserLanguages(['nl-NL', 'sv-SE']);
    expect(i18n.language).toBe('en');
  });

  it('prefers a stored language preference over the browser language', async () => {
    localStorage.setItem('lenr-language-preference', 'ko');
    const i18n = await initWithBrowserLanguages(['pt-BR']);
    expect(i18n.language).toBe('ko');
  });

  describe('<html lang> sync', () => {
    it('sets <html lang> to the detected language on init', async () => {
      await initWithBrowserLanguages(['hi-IN']);
      expect(document.documentElement.lang).toBe('hi');
    });

    it('updates <html lang> when the language changes', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      expect(document.documentElement.lang).toBe('en');
      await i18n.changeLanguage('uk');
      expect(document.documentElement.lang).toBe('uk');
      await i18n.changeLanguage('ko');
      expect(document.documentElement.lang).toBe('ko');
    });
  });

  describe('<html dir> sync', () => {
    it('sets dir="ltr" for left-to-right languages on init', async () => {
      await initWithBrowserLanguages(['en-US']);
      expect(document.documentElement.dir).toBe('ltr');
    });

    it('sets dir="rtl" and lang="ar" on init for an Arabic browser', async () => {
      await initWithBrowserLanguages(['ar-EG']);
      expect(document.documentElement.lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
    });

    it('switches to rtl for Arabic and back to ltr', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      await i18n.changeLanguage('ar');
      expect(document.documentElement.lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
      await i18n.changeLanguage('en');
      expect(document.documentElement.lang).toBe('en');
      expect(document.documentElement.dir).toBe('ltr');
      await i18n.changeLanguage('ar');
      await i18n.changeLanguage('ja');
      expect(document.documentElement.dir).toBe('ltr');
    });
  });
});
