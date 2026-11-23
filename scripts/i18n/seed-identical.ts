// One-off / maintenance seed for src/i18n/identical-allowlist.json.
//
//   npx tsx scripts/i18n/seed-identical.ts            # (re)seed from the current locale files
//
// - `invariant`: keys identical to English in ≥ INVARIANT_MIN_LOCALES locales, plus
//   the bibliographic / brand globs below. These are proper names, symbols and units.
// - every other identical leaf goes into the locale's shrink-only `baseline`.
// Existing `keep` lists (human-reviewed cognates) are preserved, and existing
// invariant entries are kept.
import { writeFileSync, existsSync } from 'node:fs';
import {
  IDENTICAL_ALLOWLIST_PATH,
  type IdenticalAllowlist,
  globToRegExp,
  identicalToEnglish,
  localeCodes,
  matchesAny,
  readIdenticalAllowlist,
  readLocale,
} from '../../src/i18n/tooling.ts';

const INVARIANT_MIN_LOCALES = 20;
const INVARIANT_GLOBS = [
  'brand.*',
  'citations.entries.*.authors',
  'citations.entries.*.institution',
  'citations.entries.*.journal',
  'transmutations.entries.*.replicatedBy',
  'transmutations.entries.*.sourceTag',
];

const en = readLocale('en');
const locales = localeCodes();
const previous: IdenticalAllowlist | undefined = existsSync(IDENTICAL_ALLOWLIST_PATH)
  ? readIdenticalAllowlist()
  : undefined;

const identical: Record<string, string[]> = {};
const counts = new Map<string, number>();
for (const l of locales) {
  identical[l] = identicalToEnglish(readLocale(l), en);
  for (const k of identical[l]) counts.set(k, (counts.get(k) ?? 0) + 1);
}

const globRes = INVARIANT_GLOBS.map(globToRegExp);
const literalInvariants = [...counts]
  .filter(([k, n]) => n >= INVARIANT_MIN_LOCALES && !matchesAny(k, globRes))
  .map(([k]) => k);
const invariant = [
  ...new Set([...(previous?.invariant ?? []), ...INVARIANT_GLOBS, ...literalInvariants]),
].sort();
const invariantRes = invariant.map(globToRegExp);

const out: IdenticalAllowlist = { invariant, locales: {} };
for (const l of locales) {
  const keep = new Set(previous?.locales[l]?.keep ?? []);
  out.locales[l] = {
    keep: [...keep].filter((k) => identical[l].includes(k)).sort(),
    baseline: identical[l].filter((k) => !matchesAny(k, invariantRes) && !keep.has(k)),
  };
}

writeFileSync(IDENTICAL_ALLOWLIST_PATH, `${JSON.stringify(out, null, 2)}\n`);
const total = Object.values(out.locales).reduce((n, v) => n + v.baseline.length, 0);
console.log(`invariant: ${invariant.length} entries; per-locale baseline: ${total} entries`);
for (const l of locales) console.log(`  ${l}: ${out.locales[l].baseline.length}`);
