import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { i18n as I18n } from 'i18next';
import de from './locales/de.json';
import fa from './locales/fa.json';

/**
 * Exercises the real i18n config (LanguageDetector + supportedLngs) with
 * different browser language lists. Each case re-imports config.ts so
 * i18next initialises from scratch.
 */
async function initWithBrowserLanguages(languages: string[]): Promise<I18n> {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0]);
  vi.resetModules();
  const { default: i18n, i18nReady } = await import('./config');
  await i18nReady;
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
    ['nl-NL', 'nl'],
    ['nl-BE', 'nl'],
    ['sv-SE', 'sv'],
    ['sv-FI', 'sv'],
    ['da-DK', 'da'],
    ['nb-NO', 'nb'],
    ['fi-FI', 'fi'],
    ['cs-CZ', 'cs'],
    ['hu-HU', 'hu'],
    ['tr-TR', 'tr'],
    ['id-ID', 'id'],
    ['vi-VN', 'vi'],
    ['sw-KE', 'sw'],
    ['sw-TZ', 'sw'],
    ['bn-BD', 'bn'],
    ['bn-IN', 'bn'],
    ['th-TH', 'th'],
    ['fa-IR', 'fa'],
    ['fa-AF', 'fa'],
    ['ur-PK', 'ur'],
    ['ur-IN', 'ur'],
  ])('maps region-coded browser language %s to %s', async (browserLang, expected) => {
    const i18n = await initWithBrowserLanguages([browserLang]);
    expect(i18n.language).toBe(expected);
    expect(i18n.resolvedLanguage).toBe(expected);
  });

  // getBestMatchFromCodes alone would fall back to English for these: `no` and
  // `nn` are different language codes from `nb`.
  it.each(['no', 'no-NO', 'nn', 'nn-NO', 'nb'])(
    'maps Norwegian browser language %s to Bokmål (nb)',
    async (browserLang) => {
      const i18n = await initWithBrowserLanguages([browserLang]);
      expect(i18n.language).toBe('nb');
      expect(i18n.resolvedLanguage).toBe('nb');
    },
  );

  it('picks the first supported language from the browser preference list', async () => {
    const i18n = await initWithBrowserLanguages(['el-GR', 'pt-BR', 'en-US']);
    expect(i18n.language).toBe('pt');
  });

  it('falls back to English for unsupported browser languages', async () => {
    const i18n = await initWithBrowserLanguages(['el-GR', 'he-IL']);
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

    it.each([
      ['fa-IR', 'fa'],
      ['ur-PK', 'ur'],
    ])('sets dir="rtl" on init for a %s browser', async (browserLang, lang) => {
      await initWithBrowserLanguages([browserLang]);
      expect(document.documentElement.lang).toBe(lang);
      expect(document.documentElement.dir).toBe('rtl');
    });

    it('switches to rtl for Persian and Urdu, and keeps Bengali and Thai ltr', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      await i18n.changeLanguage('fa');
      expect(document.documentElement.dir).toBe('rtl');
      await i18n.changeLanguage('bn');
      expect(document.documentElement.dir).toBe('ltr');
      await i18n.changeLanguage('ur');
      expect(document.documentElement.dir).toBe('rtl');
      await i18n.changeLanguage('th');
      expect(document.documentElement.dir).toBe('ltr');
    });
  });

  describe('lazy locale loading', () => {
    it('bundles only English up front', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
      expect(i18n.hasResourceBundle('de', 'translation')).toBe(false);
      expect(i18n.hasResourceBundle('fa', 'translation')).toBe(false);
    });

    it('loads a locale bundle when switching to that language', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      await i18n.changeLanguage('de');
      expect(i18n.hasResourceBundle('de', 'translation')).toBe(true);
      expect(i18n.t('language.selectLanguage')).toBe(de.language.selectLanguage);
    });

    it('has the detected language loaded by the time i18nReady resolves', async () => {
      const i18n = await initWithBrowserLanguages(['fa-IR']);
      expect(i18n.hasResourceBundle('fa', 'translation')).toBe(true);
      expect(i18n.t('language.selectLanguage')).toBe(fa.language.selectLanguage);
    });

    it('loads another language on demand for getFixedT', async () => {
      const i18n = await initWithBrowserLanguages(['en-US']);
      await i18n.loadLanguages('de');
      expect(i18n.getFixedT('de')('language.selectLanguage')).toBe(de.language.selectLanguage);
      expect(i18n.language).toBe('en');
    });
  });
});
