import { describe, it, expect } from 'vitest';
import { getMappedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './config';
import type { SupportedLanguage } from './config';

describe('i18n config', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('contains exactly 7 languages', () => {
      expect(Object.keys(SUPPORTED_LANGUAGES)).toHaveLength(7);
    });

    it('includes all expected language codes', () => {
      const expected: SupportedLanguage[] = ['en', 'ru', 'ja', 'zh', 'de', 'fr', 'es'];
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
    });

    it('falls back to default language for unknown codes', () => {
      expect(getMappedLanguage('ko')).toBe('en');
      expect(getMappedLanguage('pt')).toBe('en');
      expect(getMappedLanguage('xx-XX')).toBe('en');
      expect(getMappedLanguage('')).toBe('en');
    });
  });
});
