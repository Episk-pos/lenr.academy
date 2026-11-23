// Stale-translation guard (check 3 in CLAUDE.md → "i18n guardrails"). Pure, no git:
// every en.json edit must be stamped into source-hashes.json, which is where the
// git-aware CI ratchet (`npm run i18n:stale -- --ci`) decides whether the edit was
// re-translated, acked as English-only, or left stale (which fails the PR).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SOURCE_HASHES_PATH,
  hashValue,
  localeCodes,
  readLocale,
  readSourceHashes,
  serializeSourceHashes,
  sourceKeyOf,
} from './tooling';

const en = readLocale('en');
const data = readSourceHashes();
const STAMP_HINT =
  'run `npm run i18n:stamp`, then translate the affected locales (or `npm run i18n:ack -- <key> ' +
  '--reason "..."` if the English edit does not change meaning)';

describe('source-hashes.json', () => {
  it('uses the sha256-hex8 format', () => {
    expect(data.version).toBe(1);
    expect(data.algorithm).toBe('sha256-hex8');
    const bad = Object.entries(data.source).filter(([, h]) => !/^[0-9a-f]{8}$/.test(h));
    expect(bad).toEqual([]);
  });

  it('every en value is stamped (en.json was not edited without `npm run i18n:stamp`)', () => {
    const unstamped = Object.keys(en)
      .filter((k) => data.source[k] !== hashValue(en[k]))
      .map((k) => `${k}: ${JSON.stringify(en[k])}`);
    expect(unstamped, `en changed — ${STAMP_HINT}`).toEqual([]);
  });

  it('has no hashes for keys removed from en.json', () => {
    const removed = Object.keys(data.source).filter((k) => !(k in en));
    expect(removed, 'run `npm run i18n:stamp` to drop them').toEqual([]);
  });

  it('stale ledger only references existing locale keys', () => {
    const locales = new Set(localeCodes());
    const bad: string[] = [];
    for (const [l, entries] of Object.entries(data.stale)) {
      if (!locales.has(l)) {
        bad.push(`${l}: unknown locale`);
        continue;
      }
      const loc = readLocale(l);
      for (const [k, h] of Object.entries(entries)) {
        if (!(k in loc) || !sourceKeyOf(k, en) || !/^[0-9a-f]{8}$/.test(h)) bad.push(`${l}:${k}`);
      }
    }
    expect(bad, 'run `npm run i18n:stamp` to drop them').toEqual([]);
  });

  it('every ack has a key, hashes and a non-empty reason', () => {
    const bad = data.acks.filter(
      (a) =>
        !a.key ||
        !/^[0-9a-f]{8}$/.test(a.to) ||
        !a.reason?.trim() ||
        !a.locales ||
        !/^\d{4}-\d{2}-\d{2}$/.test(a.date),
    );
    expect(bad).toEqual([]);
  });

  it('is in canonical (sorted) form', () => {
    expect(readFileSync(SOURCE_HASHES_PATH, 'utf8')).toBe(serializeSourceHashes(data));
  });
});
