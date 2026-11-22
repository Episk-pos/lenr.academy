import { describe, it, expect } from 'vitest';
import i18n, { getMappedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './config';
import type { SupportedLanguage } from './config';

describe('i18n config', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('contains exactly 29 languages', () => {
      expect(Object.keys(SUPPORTED_LANGUAGES)).toHaveLength(29);
    });

    it('includes all expected language codes', () => {
      const expected: SupportedLanguage[] = [
        'en', 'ru', 'ja', 'zh', 'de', 'fr', 'es',
        'it', 'pt', 'uk', 'pl', 'ko', 'hi', 'ar',
        'nl', 'sv', 'da', 'nb', 'fi', 'cs', 'hu', 'tr', 'id', 'vi', 'sw',
        'bn', 'th', 'fa', 'ur',
      ];
      expected.forEach((lang) => {
        expect(SUPPORTED_LANGUAGES).toHaveProperty(lang);
      });
    });

    it('each language has name, nativeName, and flag', () => {
      Object.values(SUPPORTED_LANGUAGES).forEach((lang) => {
        expect(lang).toHaveProperty('name');
        expect(lang).toHaveProperty('nativeName');
        expect(lang).toHaveProperty('flag');
        expect(typeof lang.name).toBe('string');
        expect(typeof lang.nativeName).toBe('string');
      });
    });
  });

  describe('DEFAULT_LANGUAGE', () => {
    it('is English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });
  });

  describe('getMappedLanguage', () => {
    it('maps exact language codes', () => {
      expect(getMappedLanguage('en')).toBe('en');
      expect(getMappedLanguage('ru')).toBe('ru');
      expect(getMappedLanguage('ja')).toBe('ja');
      expect(getMappedLanguage('zh')).toBe('zh');
      expect(getMappedLanguage('de')).toBe('de');
      expect(getMappedLanguage('fr')).toBe('fr');
      expect(getMappedLanguage('es')).toBe('es');
      expect(getMappedLanguage('it')).toBe('it');
      expect(getMappedLanguage('pt')).toBe('pt');
      expect(getMappedLanguage('uk')).toBe('uk');
      expect(getMappedLanguage('pl')).toBe('pl');
      expect(getMappedLanguage('ko')).toBe('ko');
      expect(getMappedLanguage('hi')).toBe('hi');
      expect(getMappedLanguage('ar')).toBe('ar');
      expect(getMappedLanguage('nl')).toBe('nl');
      expect(getMappedLanguage('sv')).toBe('sv');
      expect(getMappedLanguage('da')).toBe('da');
      expect(getMappedLanguage('nb')).toBe('nb');
      expect(getMappedLanguage('fi')).toBe('fi');
      expect(getMappedLanguage('cs')).toBe('cs');
      expect(getMappedLanguage('hu')).toBe('hu');
      expect(getMappedLanguage('tr')).toBe('tr');
      expect(getMappedLanguage('id')).toBe('id');
      expect(getMappedLanguage('vi')).toBe('vi');
      expect(getMappedLanguage('sw')).toBe('sw');
      expect(getMappedLanguage('bn')).toBe('bn');
      expect(getMappedLanguage('th')).toBe('th');
      expect(getMappedLanguage('fa')).toBe('fa');
      expect(getMappedLanguage('ur')).toBe('ur');
    });

    it('maps regional variants to base languages', () => {
      expect(getMappedLanguage('en-US')).toBe('en');
      expect(getMappedLanguage('en-GB')).toBe('en');
      expect(getMappedLanguage('de-DE')).toBe('de');
      expect(getMappedLanguage('de-AT')).toBe('de');
      expect(getMappedLanguage('de-CH')).toBe('de');
      expect(getMappedLanguage('fr-FR')).toBe('fr');
      expect(getMappedLanguage('fr-CA')).toBe('fr');
      expect(getMappedLanguage('es-ES')).toBe('es');
      expect(getMappedLanguage('es-MX')).toBe('es');
      expect(getMappedLanguage('zh-CN')).toBe('zh');
      expect(getMappedLanguage('zh-TW')).toBe('zh');
      expect(getMappedLanguage('ja-JP')).toBe('ja');
      expect(getMappedLanguage('ru-RU')).toBe('ru');
      expect(getMappedLanguage('it-IT')).toBe('it');
      expect(getMappedLanguage('it-CH')).toBe('it');
      expect(getMappedLanguage('pt-BR')).toBe('pt');
      expect(getMappedLanguage('pt-PT')).toBe('pt');
      expect(getMappedLanguage('uk-UA')).toBe('uk');
      expect(getMappedLanguage('pl-PL')).toBe('pl');
      expect(getMappedLanguage('ko-KR')).toBe('ko');
      expect(getMappedLanguage('hi-IN')).toBe('hi');
      expect(getMappedLanguage('ar-SA')).toBe('ar');
      expect(getMappedLanguage('ar-EG')).toBe('ar');
      expect(getMappedLanguage('ar-AE')).toBe('ar');
      expect(getMappedLanguage('nl-NL')).toBe('nl');
      expect(getMappedLanguage('nl-BE')).toBe('nl');
      expect(getMappedLanguage('sv-SE')).toBe('sv');
      expect(getMappedLanguage('sv-FI')).toBe('sv');
      expect(getMappedLanguage('da-DK')).toBe('da');
      expect(getMappedLanguage('nb-NO')).toBe('nb');
      expect(getMappedLanguage('fi-FI')).toBe('fi');
      expect(getMappedLanguage('cs-CZ')).toBe('cs');
      expect(getMappedLanguage('hu-HU')).toBe('hu');
      expect(getMappedLanguage('tr-TR')).toBe('tr');
      expect(getMappedLanguage('id-ID')).toBe('id');
      expect(getMappedLanguage('vi-VN')).toBe('vi');
      expect(getMappedLanguage('sw-KE')).toBe('sw');
      expect(getMappedLanguage('sw-TZ')).toBe('sw');
      expect(getMappedLanguage('bn-BD')).toBe('bn');
      expect(getMappedLanguage('bn-IN')).toBe('bn');
      expect(getMappedLanguage('th-TH')).toBe('th');
      expect(getMappedLanguage('fa-IR')).toBe('fa');
      expect(getMappedLanguage('fa-AF')).toBe('fa');
      expect(getMappedLanguage('ur-PK')).toBe('ur');
      expect(getMappedLanguage('ur-IN')).toBe('ur');
    });

    it('maps every Norwegian code to Bokmål', () => {
      for (const code of ['no', 'no-NO', 'nn', 'nn-NO', 'nb', 'nb-NO']) {
        expect(getMappedLanguage(code), code).toBe('nb');
      }
    });

    it('falls back to default language for unknown codes', () => {
      expect(getMappedLanguage('el')).toBe('en');
      expect(getMappedLanguage('he-IL')).toBe('en');
      expect(getMappedLanguage('xx-XX')).toBe('en');
      expect(getMappedLanguage('')).toBe('en');
    });
  });

  describe('text direction', () => {
    it('is right-to-left for Arabic, Persian and Urdu', () => {
      for (const lang of ['ar', 'fa', 'ur']) expect(i18n.dir(lang), lang).toBe('rtl');
    });

    it('is left-to-right for every other supported language', () => {
      const rtl = new Set(['ar', 'fa', 'ur']);
      for (const lang of Object.keys(SUPPORTED_LANGUAGES).filter((l) => !rtl.has(l))) {
        expect(i18n.dir(lang), lang).toBe('ltr');
      }
    });
  });
});
