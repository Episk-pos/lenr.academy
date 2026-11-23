// Data-shape guard for user-facing data tables (check 1b in CLAUDE.md → "i18n guardrails").
//
// These tables keep their English copy in the data file and render it through
// `t(key, { defaultValue: english })`, so a missing key silently shows English in
// every locale. This test enumerates every row and requires that:
//   - the key exists in en.json, and
//   - en.json carries the same English as the data file (so English edits land in
//     en.json, where the stale-translation hashes see them).
// A new table rendered via t(`prefix.${id}.field`) must be registered in TABLES.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import en from './locales/en.json';
import { flatten } from './tooling';
import { GLOSSARY } from '../data/glossary';
import { EXAMPLE_QUERIES } from '../data/exampleQueries';
import { DOCUMENTED_TRANSMUTATIONS } from '../data/documentedTransmutations';
import { citations } from '../data/citations';
import { ALL_BUILTIN_MATERIALS } from '../constants/materials';
import { RADIATION_TYPE_INFO } from '../constants/radiationTypes';

const enFlat = flatten(en as Record<string, unknown>);

type Row = Record<string, unknown>;
interface Table {
  name: string;
  rows: Row[];
  id: (row: Row) => string;
  prefix: string;
  /** field name, or [field, how the UI derives the English fallback from the row] */
  fields: (string | [string, (row: Row) => string | undefined])[];
}

const TABLES: Table[] = [
  {
    name: 'example queries',
    rows: EXAMPLE_QUERIES as unknown as Row[],
    id: (r) => String(r.key),
    prefix: 'help.examples',
    fields: ['name', 'description'],
  },
  {
    name: 'documented transmutations',
    rows: DOCUMENTED_TRANSMUTATIONS as unknown as Row[],
    id: (r) => String(r.id),
    prefix: 'transmutations.entries',
    fields: [
      'source',
      'setup',
      'hypothesizedMechanism',
      'notes',
      'sourceTag',
      ['replicatedBy', (r) => (r.replicatedBy as string[] | undefined)?.join(', ')],
    ],
  },
  {
    name: 'citations',
    rows: citations as unknown as Row[],
    id: (r) => String(r.id),
    prefix: 'citations.entries',
    fields: ['authors', 'title', 'journal', 'institution', 'excerpt'],
  },
  {
    name: 'materials',
    rows: ALL_BUILTIN_MATERIALS as unknown as Row[],
    id: (r) => String(r.id),
    prefix: 'materials',
    fields: ['name', 'description'],
  },
  {
    name: 'radiation types',
    rows: Object.entries(RADIATION_TYPE_INFO).map(([code, info]) => ({ code, ...info })),
    id: (r) => String(r.code),
    prefix: 'radiationTypes',
    fields: ['name', 'description'],
  },
];

describe('user-facing data tables are keyed in en.json', () => {
  for (const table of TABLES) {
    it(`${table.name}: every row has en.json copy matching the data file`, () => {
      const problems: string[] = [];
      for (const row of table.rows) {
        for (const field of table.fields) {
          const [name, english] =
            typeof field === 'string'
              ? [field, row[field] as string | undefined]
              : [field[0], field[1](row)];
          if (english === undefined || english === '') continue;
          const key = `${table.prefix}.${table.id(row)}.${name}`;
          if (!(key in enFlat)) problems.push(`missing ${key}`);
          else if (enFlat[key] !== english)
            problems.push(`${key}: en.json ${JSON.stringify(enFlat[key])} ≠ data ${JSON.stringify(english)}`);
        }
      }
      expect(
        problems,
        `${table.name}: add/update these keys in src/i18n/locales/en.json (and all locales)`,
      ).toEqual([]);
    });
  }

  it('glossary: every entry has an i18nKey whose term/definition match en.json', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const entry of GLOSSARY) {
      if (!entry.i18nKey) {
        problems.push(`${entry.term}: no i18nKey`);
        continue;
      }
      if (seen.has(entry.i18nKey)) problems.push(`${entry.term}: duplicate i18nKey ${entry.i18nKey}`);
      seen.add(entry.i18nKey);
      for (const [field, english] of [
        ['term', entry.term],
        ['definition', entry.definition],
      ]) {
        const key = `${entry.i18nKey}.${field}`;
        if (!(key in enFlat)) problems.push(`missing ${key}`);
        else if (enFlat[key] !== english)
          problems.push(`${key}: en.json ${JSON.stringify(enFlat[key])} ≠ data ${JSON.stringify(english)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  // Shrink-only: related terms with no glossary entry of their own, so their chip
  // shows the raw English string. Add an entry (or drop the chip), then remove it here.
  const UNTRANSLATED_RELATED_TERMS = [
    'Atomic Number (Z) → Element',
    'Isotope → Neutron',
    'Mass Number (A) → Nucleon',
    'Neutrino → Weak Force',
  ];

  it('glossary: related-term chips all point at glossary entries (else they render untranslated)', () => {
    const terms = new Set(GLOSSARY.map((e) => e.term));
    const dangling = GLOSSARY.flatMap((e) =>
      (e.relatedTerms ?? []).filter((r) => !terms.has(r)).map((r) => `${e.term} → ${r}`),
    ).sort();
    expect(
      dangling.filter((d) => !UNTRANSLATED_RELATED_TERMS.includes(d)),
      'new related terms without a glossary entry (they render in English)',
    ).toEqual([]);
    expect(
      UNTRANSLATED_RELATED_TERMS.filter((d) => !dangling.includes(d)),
      'fixed — remove these from UNTRANSLATED_RELATED_TERMS',
    ).toEqual([]);
  });

  it('decay series presets are not rendered yet (register them in TABLES when they are)', () => {
    // DECAY_SERIES_PRESETS (src/constants/decaySeries.ts) holds English name /
    // description / characteristics with no i18n keys. That is fine while no UI
    // renders it; once a component or page imports it, key its copy in en.json
    // and add a TABLES row above.
    const uiDirs = ['components', 'pages'].map((d) => resolve(__dirname, '..', d));
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );
    const importers = uiDirs
      .flatMap(walk)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /constants\/decaySeries['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([]);
  });
});
