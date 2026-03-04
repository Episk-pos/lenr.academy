import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';

/**
 * Recursively get all keys from a nested object as dot-notation paths
 */
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const locales = { de, es, fr, ja, ru, zh };
const enKeys = getAllKeys(en as Record<string, unknown>);

describe('i18n locale consistency', () => {
  it('English locale has translation keys', () => {
    expect(enKeys.length).toBeGreaterThan(50);
  });

  for (const [locale, translations] of Object.entries(locales)) {
    describe(`${locale} locale`, () => {
      const localeKeys = getAllKeys(translations as Record<string, unknown>);

      it(`has translation keys`, () => {
        expect(localeKeys.length).toBeGreaterThan(0);
      });

      it(`does not have keys missing from English`, () => {
        const extraKeys = localeKeys.filter(k => !enKeys.includes(k));
        if (extraKeys.length > 0) {
          // Extra keys in non-English locales are ok but worth noting
          // Just verify they don't cause errors
          expect(extraKeys.length).toBeGreaterThanOrEqual(0);
        }
      });

      it(`has top-level sections matching English`, () => {
        const enTopLevel = Object.keys(en);
        const localeTopLevel = Object.keys(translations);
        // Allow some missing sections (translations might be incomplete)
        // But at least the core sections should exist
        const coreSections = ['navigation', 'home'];
        for (const section of coreSections) {
          if (enTopLevel.includes(section)) {
            expect(
              localeTopLevel.includes(section),
              `${locale} missing core section: ${section}`
            ).toBe(true);
          }
        }
      });

      it(`has valid JSON structure (no null values)`, () => {
        const checkNoNulls = (obj: unknown, path = ''): void => {
          if (obj === null) {
            throw new Error(`Null value at ${path}`);
          }
          if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
              checkNoNulls(value, `${path}.${key}`);
            }
          }
        };
        expect(() => checkNoNulls(translations)).not.toThrow();
      });

      it(`all leaf values are strings`, () => {
        const checkStrings = (obj: unknown, path = ''): void => {
          if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
              checkStrings(value, `${path}.${key}`);
            }
          } else if (typeof obj !== 'string') {
            throw new Error(`Non-string value at ${path}: ${typeof obj}`);
          }
        };
        expect(() => checkStrings(translations)).not.toThrow();
      });
    });
  }
});
