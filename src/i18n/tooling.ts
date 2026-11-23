// Shared helpers for the i18n guardrails: the src/i18n/*.test.ts checks and the
// scripts/i18n/*.ts CLIs (i18n:stale / i18n:stamp / i18n:ack). Node-only; never
// imported by application code.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const LOCALES_DIR = resolve(HERE, 'locales');
export const LOCALES_REL_DIR = 'src/i18n/locales';

export type Flat = Record<string, string>;

/** Flatten nested locale JSON into dot-notation key -> string leaf */
export function flatten(obj: Record<string, unknown>, prefix = ''): Flat {
  const out: Flat = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

/** Locale codes with a file in src/i18n/locales, sorted, `en` excluded */
export function localeCodes(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((l) => l !== 'en')
    .sort();
}

export function readLocale(locale: string): Flat {
  return flatten(JSON.parse(readFileSync(resolve(LOCALES_DIR, `${locale}.json`), 'utf8')));
}

/** sha256 of the UTF-8 value, first 8 hex chars ("sha256-hex8") */
export function hashValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 8);
}

// CLDR plural categories a locale may need that English does not have
const EXTRA_PLURAL_SUFFIX = /^(.*)_(zero|two|few|many)$/;

/**
 * The en key a locale leaf was translated from: the key itself, or `<base>_other`
 * for extra CLDR plural forms (`_zero/_two/_few/_many`) English does not define.
 */
export function sourceKeyOf(key: string, enFlat: Flat): string | undefined {
  if (key in enFlat) return key;
  const m = key.match(EXTRA_PLURAL_SUFFIX);
  if (m && `${m[1]}_other` in enFlat) return `${m[1]}_other`;
  return undefined;
}

/** Glob over dot-separated keys: `*` matches within one segment, `**` across segments */
export function globToRegExp(glob: string): RegExp {
  const body = glob
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^.]*'),
    )
    .join('.*');
  return new RegExp(`^${body}$`);
}

export function matchesAny(key: string, globs: RegExp[]): boolean {
  return globs.some((re) => re.test(key));
}

/** True if a value has real words (a run of ≥2 letters once {{vars}} and <tags> are removed) */
export function hasLetters(value: string): boolean {
  return /\p{L}{2,}/u.test(value.replace(/\{\{[^}]*\}\}|<[^>]+>/g, ''));
}

/** Sort object keys recursively so the JSON files diff cleanly */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeysDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    ) as T;
  }
  return value;
}

// ── source-hashes.json ───────────────────────────────────────────────────────

export const SOURCE_HASHES_PATH = resolve(HERE, 'source-hashes.json');

export interface Ack {
  key: string;
  from: string | null;
  to: string;
  locales: string; // "*" or comma-separated locale codes
  reason: string;
  date: string;
}

export interface SourceHashes {
  version: 1;
  algorithm: 'sha256-hex8';
  /** en key -> hash of the en value every locale's translation corresponds to */
  source: Record<string, string>;
  /** locale -> key -> hash of the (older) en value that locale was translated against */
  stale: Record<string, Record<string, string>>;
  /** Append-only audit log of English-only edits that need no re-translation */
  acks: Ack[];
}

export function readSourceHashes(path = SOURCE_HASHES_PATH): SourceHashes {
  return JSON.parse(readFileSync(path, 'utf8')) as SourceHashes;
}

export function serializeSourceHashes(data: SourceHashes): string {
  const stale = Object.fromEntries(
    Object.keys(data.stale)
      .sort()
      .filter((l) => Object.keys(data.stale[l]).length > 0)
      .map((l) => [l, sortKeysDeep(data.stale[l])]),
  );
  const ordered = {
    version: data.version,
    algorithm: data.algorithm,
    source: sortKeysDeep(data.source),
    stale,
    acks: data.acks,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

// ── identical-allowlist.json ─────────────────────────────────────────────────

export const IDENTICAL_ALLOWLIST_PATH = resolve(HERE, 'identical-allowlist.json');

export interface IdenticalAllowlist {
  /** Keys (globs) whose value is correctly identical to English in every locale */
  invariant: string[];
  /**
   * Per locale: `keep` = reviewed, intentionally identical (cognates, names);
   * `baseline` = known untranslated debt, shrink-only.
   */
  locales: Record<string, { keep: string[]; baseline: string[] }>;
}

export function readIdenticalAllowlist(path = IDENTICAL_ALLOWLIST_PATH): IdenticalAllowlist {
  return JSON.parse(readFileSync(path, 'utf8')) as IdenticalAllowlist;
}

/** The English value a locale leaf must not simply copy (plural extras compare to _other) */
export function englishReference(key: string, enFlat: Flat): string | undefined {
  const src = sourceKeyOf(key, enFlat);
  return src === undefined ? undefined : enFlat[src];
}

/** Locale leaves whose value is identical to English and contains real words */
export function identicalToEnglish(localeFlat: Flat, enFlat: Flat): string[] {
  return Object.keys(localeFlat)
    .filter((k) => {
      const ref = englishReference(k, enFlat);
      return ref !== undefined && localeFlat[k] === ref && hasLetters(ref);
    })
    .sort();
}
