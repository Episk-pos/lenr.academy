import { describe, it, expect } from 'vitest';
import { createInstance } from 'i18next';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_LANGUAGES } from './config';
import {
  flatten as flattenStrings,
  globToRegExp,
  identicalToEnglish,
  matchesAny,
  type IdenticalAllowlist,
} from './tooling';
import identicalAllowlistJson from './identical-allowlist.json';
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
import ar from './locales/ar.json';
import nl from './locales/nl.json';
import sv from './locales/sv.json';
import da from './locales/da.json';
import nb from './locales/nb.json';
import fi from './locales/fi.json';
import cs from './locales/cs.json';
import hu from './locales/hu.json';
import tr from './locales/tr.json';
import id from './locales/id.json';
import vi from './locales/vi.json';
import sw from './locales/sw.json';
import bn from './locales/bn.json';
import th from './locales/th.json';
import fa from './locales/fa.json';
import ur from './locales/ur.json';

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

const locales = {
  de, es, fr, ja, ru, zh, it: it_, pt, uk, pl, ko, hi, ar,
  nl, sv, da, nb, fi, cs, hu, tr, id, vi, sw,
  bn, th, fa, ur,
};
const enKeys = getAllKeys(en as Record<string, unknown>);
const enFlat = flatten(en as Record<string, unknown>);
const enStrings = flattenStrings(en as Record<string, unknown>);

// Values allowed to stay identical to English (see identical-allowlist.json and
// CLAUDE.md → "i18n guardrails"): `invariant` for every locale, per-locale `keep`
// (reviewed cognates/names) and the shrink-only `baseline` of untranslated debt.
const identicalAllowlist = identicalAllowlistJson as IdenticalAllowlist;
const invariantRes = identicalAllowlist.invariant.map(globToRegExp);
const ALLOWLIST_HINT =
  'translate them, or (proper names, symbols, units, real cognates only) add them to ' +
  'src/i18n/identical-allowlist.json → locales.<locale>.keep';

/** True if English defines `base` as a plural key (base_one / base_other) */
function isEnPluralBase(base: string): boolean {
  return `${base}_one` in enFlat || `${base}_other` in enFlat;
}

describe('i18n locale consistency', () => {
  it('English locale has translation keys', () => {
    expect(enKeys.length).toBeGreaterThan(50);
  });

  it('checks every locale file and every supported language', () => {
    const files = readdirSync(resolve(__dirname, 'locales'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    const checked = ['en', ...Object.keys(locales)].sort();
    expect(checked).toEqual(files);
    expect(checked).toEqual(Object.keys(SUPPORTED_LANGUAGES).sort());
  });

  it('identical-allowlist invariant entries all match English keys', () => {
    const unmatched = identicalAllowlist.invariant.filter(
      (glob) => !Object.keys(enStrings).some((k) => globToRegExp(glob).test(k)),
    );
    expect(unmatched, 'remove these from identical-allowlist.json invariant').toEqual([]);
  });

  it('identical-allowlist lists exactly the supported locales', () => {
    expect(Object.keys(identicalAllowlist.locales).sort()).toEqual(Object.keys(locales).sort());
  });

  for (const [locale, translations] of Object.entries(locales)) {
    describe(`${locale} locale`, () => {
      const identical = new Set(
        identicalToEnglish(flattenStrings(translations as Record<string, unknown>), enStrings),
      );
      const allow = identicalAllowlist.locales[locale] ?? { keep: [], baseline: [] };

      it(`has no values left identical to English (except allowlisted)`, () => {
        const listed = new Set([...allow.keep, ...allow.baseline]);
        const offenders = [...identical].filter(
          (k) => !matchesAny(k, invariantRes) && !listed.has(k),
        );
        expect(
          offenders,
          `${locale}: these values are identical to English — ${ALLOWLIST_HINT}`,
        ).toEqual([]);
      });

      it(`identical-to-English allowlist only shrinks`, () => {
        const gone = [...allow.keep, ...allow.baseline].filter((k) => !identical.has(k));
        expect(
          gone,
          `${locale}: these are translated now (or removed) — delete them from ` +
            `src/i18n/identical-allowlist.json → locales.${locale}`,
        ).toEqual([]);
      });

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

describe('Russian plural forms', () => {
  it('renders transmutations.stepCount with correct one/few/many forms', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'ru', resources: { ru: { translation: ru } } });
    const render = (count: number) => i18n.t('transmutations.stepCount', { count });
    expect(render(1)).toBe('1 шаг');
    expect(render(21)).toBe('21 шаг');
    expect(render(2)).toBe('2 шага');
    expect(render(24)).toBe('24 шага');
    expect(render(5)).toBe('5 шагов');
    expect(render(11)).toBe('11 шагов');
  });
});
