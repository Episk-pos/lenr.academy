import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';
import it_ from './locales/it.json';
import pt from './locales/pt.json';
import uk from './locales/uk.json';
import pl from './locales/pl.json';
import ko from './locales/ko.json';
import hi from './locales/hi.json';

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

/**
 * Recursively flatten a nested object into a map of dot-notation path -> leaf value
 */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

/** Extract the set of interpolation variable names ({{name}}, {{name, format}}) from a string */
function getPlaceholders(value: unknown): Set<string> {
  if (typeof value !== 'string') return new Set();
  return new Set([...value.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1]));
}

const PLURAL_SUFFIX = /^(.*)_(zero|one|two|few|many|other)$/;
// CLDR plural categories a locale may need that English does not have
const EXTRA_PLURAL_SUFFIX = /^(.*)_(zero|two|few|many)$/;

const locales = { de, es, fr, ja, ru, zh, it: it_, pt, uk, pl, ko, hi };
const enKeys = getAllKeys(en as Record<string, unknown>);
const enFlat = flatten(en as Record<string, unknown>);

/** True if English defines `base` as a plural key (base_one / base_other) */
function isEnPluralBase(base: string): boolean {
  return `${base}_one` in enFlat || `${base}_other` in enFlat;
}

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

      it(`has every key defined in English`, () => {
        const missingKeys = enKeys.filter(k => !localeKeys.includes(k));
        expect(missingKeys, `${locale} is missing keys`).toEqual([]);
      });

      it(`has no keys absent from English (except CLDR plural forms)`, () => {
        const extraKeys = localeKeys.filter((k) => {
          if (k in enFlat) return false;
          // Allow e.g. foo_few / foo_many when English has foo_one / foo_other
          const match = k.match(EXTRA_PLURAL_SUFFIX);
          return !(match && isEnPluralBase(match[1]));
        });
        expect(extraKeys, `${locale} has unexpected keys`).toEqual([]);
      });

      it(`uses the same {{placeholders}} as English`, () => {
        const localeFlat = flatten(translations as Record<string, unknown>);
        const mismatches: string[] = [];
        for (const [key, value] of Object.entries(localeFlat)) {
          const pluralMatch = key.match(PLURAL_SUFFIX);
          const isPlural = !!pluralMatch && isEnPluralBase(pluralMatch[1]);
          // Plural forms compare against English's _other form
          const reference = isPlural ? enFlat[`${pluralMatch![1]}_other`] : enFlat[key];
          if (reference === undefined) continue;

          const actual = getPlaceholders(value);
          const expected = getPlaceholders(reference);
          if (isPlural) {
            // {{count}} is optional in plural forms (e.g. en "1 step" vs uk "{{count}} крок")
            actual.delete('count');
            expected.delete('count');
          }
          const same = actual.size === expected.size && [...actual].every((p) => expected.has(p));
          if (!same) {
            mismatches.push(`${key}: [${[...actual].sort()}] vs en [${[...expected].sort()}]`);
          }
        }
        expect(mismatches, `${locale} placeholder mismatches`).toEqual([]);
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
