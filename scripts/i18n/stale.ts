// Stale-translation tracking (check 3 in CLAUDE.md → "i18n guardrails").
//
// src/i18n/source-hashes.json records, per en key, the hash of the English each
// locale was translated from, plus a ledger of known-stale locale entries and an
// audit log of English-only edits ("acks").
//
//   npm run i18n:stale                       report: unstamped en edits (exit 1) + stale ledger
//   npm run i18n:stale -- --locale de        ...list the de ledger entries
//   npm run i18n:stale -- --ci --base origin/main
//                                            PR ratchet: fail if this branch changed en values
//                                            without translating or acking them, or grew the ledger
//   npm run i18n:stamp [-- --base <ref>]     after editing en.json and/or translating: refresh
//                                            hashes; locale values changed vs base count as
//                                            re-translated, untouched ones go into the ledger
//   npm run i18n:ack -- <key|glob>... --reason "typo fix" [--locale de,fr]
//                                            English-only edit: no re-translation needed
//   npx tsx scripts/i18n/stale.ts init [--replay]
//                                            (re)seed from scratch; --replay imports likely-stale
//                                            entries from git history into the ledger
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import {
  LOCALES_REL_DIR,
  SOURCE_HASHES_PATH,
  type Flat,
  type SourceHashes,
  flatten,
  globToRegExp,
  hashValue,
  localeCodes,
  readLocale,
  readSourceHashes,
  serializeSourceHashes,
  sourceKeyOf,
} from '../../src/i18n/tooling.ts';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'report';
const positional: string[] = [];
const flags: Record<string, string | true> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const [name, inline] = a.slice(2).split(/=(.*)/s);
    const next = argv[i + 1];
    if (inline !== undefined) flags[name] = inline;
    else if (['base', 'reason', 'locale'].includes(name) && next !== undefined) flags[name] = argv[++i];
    else flags[name] = true;
  } else positional.push(a);
}
const flag = (name: string) => (typeof flags[name] === 'string' ? (flags[name] as string) : undefined);

// ── git helpers ──────────────────────────────────────────────────────────────
function git(...args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function mergeBase(ref: string): string {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    console.error(
      `✗ Base ref "${ref}" not found. Fetch it first (git fetch origin main), or pass ` +
        '--base <ref> (fork contributors: --base upstream/main).',
    );
    process.exit(2);
  }
  return git('merge-base', 'HEAD', ref).trim();
}

function localeAt(rev: string, locale: string): Flat {
  try {
    return flatten(JSON.parse(git('show', `${rev}:${LOCALES_REL_DIR}/${locale}.json`)));
  } catch {
    return {};
  }
}

function sourceHashesAt(rev: string): SourceHashes | undefined {
  try {
    return JSON.parse(git('show', `${rev}:src/i18n/source-hashes.json`)) as SourceHashes;
  } catch {
    return undefined;
  }
}

// ── shared ───────────────────────────────────────────────────────────────────
const en = readLocale('en');
const locales = localeCodes();

function unstamped(data: SourceHashes): { changed: string[]; removed: string[] } {
  return {
    changed: Object.keys(en).filter((k) => data.source[k] !== hashValue(en[k])),
    removed: Object.keys(data.source).filter((k) => !(k in en)),
  };
}

/** An ack of the current en value of `key` covering locale `l` */
function isAcked(data: SourceHashes, key: string, l: string, acks = data.acks): boolean {
  const to = hashValue(en[key]);
  return acks.some(
    (a) => a.key === key && a.to === to && (a.locales === '*' || a.locales.split(',').includes(l)),
  );
}

function save(data: SourceHashes) {
  writeFileSync(SOURCE_HASHES_PATH, serializeSourceHashes(data));
}

function expandKeys(patterns: string[]): string[] {
  const keys = new Set<string>();
  for (const p of patterns) {
    const re = globToRegExp(p);
    const hits = Object.keys(en).filter((k) => re.test(k) || k === `${p}_one` || k === `${p}_other`);
    if (!hits.length) {
      console.error(`✗ "${p}" matches no key in en.json`);
      process.exit(2);
    }
    hits.forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

const short = (v: string | undefined, n = 70) =>
  v === undefined ? '∅' : JSON.stringify(v.length > n ? `${v.slice(0, n - 1)}…` : v);

// ── init ─────────────────────────────────────────────────────────────────────
function init() {
  const data: SourceHashes = {
    version: 1,
    algorithm: 'sha256-hex8',
    source: Object.fromEntries(Object.keys(en).map((k) => [k, hashValue(en[k])])),
    stale: {},
    acks: [],
  };
  if (flags.replay) replayHistory(data);
  save(data);
  const n = Object.values(data.stale).reduce((s, m) => s + Object.keys(m).length, 0);
  console.log(`Seeded ${Object.keys(data.source).length} source hashes, ${n} stale ledger entries.`);
}

/**
 * Import likely-stale entries from git history: a locale value is stale if its en
 * source last changed in a later commit than the locale value itself. The recorded
 * hash is that of the en value as of the locale's last change.
 */
function replayHistory(data: SourceHashes) {
  const order = git('log', '--topo-order', '--reverse', '--format=%H').trim().split('\n');
  const idx = new Map(order.map((h, i) => [h, i]));
  const enPath = `${LOCALES_REL_DIR}/en.json`;
  const enAt = new Map<string, Flat>();
  const enAtRev = (h: string) => {
    if (!enAt.has(h)) {
      try {
        enAt.set(h, flatten(JSON.parse(git('show', `${h}:${enPath}`))));
      } catch {
        enAt.set(h, {});
      }
    }
    return enAt.get(h)!;
  };
  const lastChange = (path: string) => {
    const last = new Map<string, string>();
    let prev: Flat = {};
    const revs = git('log', '--topo-order', '--reverse', '--format=%H', '--', path).trim().split('\n');
    for (const h of revs.filter(Boolean)) {
      let cur: Flat;
      try {
        cur = flatten(JSON.parse(git('show', `${h}:${path}`)));
      } catch {
        continue;
      }
      for (const [k, v] of Object.entries(cur)) if (prev[k] !== v) last.set(k, h);
      prev = cur;
    }
    return last;
  };
  const enLast = lastChange(enPath);
  for (const l of locales) {
    const locLast = lastChange(`${LOCALES_REL_DIR}/${l}.json`);
    const current = readLocale(l);
    for (const lk of Object.keys(current)) {
      const src = sourceKeyOf(lk, en);
      if (!src) continue;
      const eh = enLast.get(src);
      const lh = locLast.get(lk);
      if (!eh || !lh || idx.get(eh)! <= idx.get(lh)!) continue;
      const old = enAtRev(lh)[src];
      if (old === undefined || old === en[src]) continue;
      (data.stale[l] ??= {})[lk] = hashValue(old);
    }
  }
}

// ── stamp ────────────────────────────────────────────────────────────────────
function stamp() {
  const data = readSourceHashes();
  const base = mergeBase(flag('base') ?? 'origin/main');
  const { changed, removed } = unstamped(data);
  const changedSet = new Set(changed);
  const updated: string[] = [];
  const nowStale: string[] = [];
  const cleared: string[] = [];

  for (const l of locales) {
    const cur = readLocale(l);
    const before = localeAt(base, l);
    const ledger = (data.stale[l] ??= {});
    for (const lk of Object.keys(cur)) {
      const src = sourceKeyOf(lk, en);
      if (!src) continue;
      const touched = before[lk] !== cur[lk];
      if (changedSet.has(src)) {
        if (data.source[src] === undefined) continue; // new en key: fresh
        if (isAcked(data, src, l)) continue;
        if (touched) {
          if (ledger[lk]) delete ledger[lk];
          updated.push(`${l}:${lk}`);
        } else if (!ledger[lk]) {
          ledger[lk] = data.source[src];
          nowStale.push(`${l}:${lk}`);
        }
      } else if (ledger[lk] && touched) {
        delete ledger[lk];
        cleared.push(`${l}:${lk}`);
      }
    }
    for (const lk of Object.keys(ledger)) if (!(lk in cur) || !sourceKeyOf(lk, en)) delete ledger[lk];
  }
  for (const k of changed) data.source[k] = hashValue(en[k]);
  for (const k of removed) delete data.source[k];
  save(data);

  console.log(`Stamped ${changed.length} changed en key(s), dropped ${removed.length} removed key(s) (base ${base.slice(0, 10)}).`);
  if (updated.length) {
    console.log(`\nTreated as re-translated (value changed vs base) — check these are real translations:`);
    for (const e of updated) console.log(`  ${e}`);
  }
  if (cleared.length) {
    console.log(`\nCleared from the stale ledger (re-translated):`);
    for (const e of cleared) console.log(`  ${e}`);
  }
  if (nowStale.length) {
    console.log(
      `\n⚠ ${nowStale.length} locale value(s) not updated — recorded as stale. CI blocks this PR until ` +
        'they are translated (then re-run i18n:stamp) or acked as an English-only edit (i18n:ack):',
    );
    for (const e of nowStale) console.log(`  ${e}`);
  }
}

// ── ack ──────────────────────────────────────────────────────────────────────
function ack() {
  const reason = flag('reason')?.trim();
  if (!reason) {
    console.error('✗ --reason "<why no re-translation is needed>" is required.');
    process.exit(2);
  }
  if (!positional.length) {
    console.error('✗ Usage: npm run i18n:ack -- <key|glob>... --reason "..." [--locale de,fr]');
    process.exit(2);
  }
  const only = flag('locale')?.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = (only ?? []).filter((l) => !locales.includes(l));
  if (unknown.length) {
    console.error(`✗ Unknown locale(s): ${unknown.join(', ')}`);
    process.exit(2);
  }
  const data = readSourceHashes();
  const date = new Date().toISOString().slice(0, 10);
  for (const key of expandKeys(positional)) {
    const to = hashValue(en[key]);
    data.acks.push({
      key,
      from: data.source[key] ?? null,
      to,
      locales: only ? only.join(',') : '*',
      reason,
      date,
    });
    if (!only) data.source[key] = to;
    for (const l of only ?? locales) {
      const ledger = data.stale[l] ?? {};
      for (const lk of Object.keys(ledger)) if (sourceKeyOf(lk, en) === key) delete ledger[lk];
    }
    console.log(`acked ${key} (${only ? only.join(',') : 'all locales'}): ${reason}`);
  }
  if (only) {
    console.log(
      '\nNote: a --locale ack covers only those locales; translate the others, then run ' +
        '`npm run i18n:stamp` to update the source hash.',
    );
  }
  save(data);
}

// ── report / CI ratchet ──────────────────────────────────────────────────────
function ratchet(): string[] {
  const base = mergeBase(flag('base') ?? 'origin/main');
  const problems: string[] = [];
  const enBase = localeAt(base, 'en');
  const head = readSourceHashes();
  const baseData = sourceHashesAt(base);

  const baseAcks = baseData?.acks ?? [];
  const prefixOk =
    baseAcks.length <= head.acks.length &&
    baseAcks.every((a, i) => JSON.stringify(a) === JSON.stringify(head.acks[i]));
  if (!prefixOk) problems.push('source-hashes.json "acks" is append-only: existing entries were edited or removed.');
  const newAcks = prefixOk ? head.acks.slice(baseAcks.length) : head.acks;

  const changed = Object.keys(en).filter((k) => k in enBase && enBase[k] !== en[k]);
  const changedSet = new Set(changed);
  const missing: Record<string, string[]> = {};
  for (const l of locales) {
    const cur = readLocale(l);
    const before = localeAt(base, l);
    for (const lk of Object.keys(cur)) {
      const src = sourceKeyOf(lk, en);
      if (!src || !changedSet.has(src) || before[lk] !== cur[lk]) continue;
      if (!isAcked(head, src, l, newAcks)) (missing[src] ??= []).push(lk === src ? l : `${l}:${lk}`);
    }
  }
  for (const [k, ls] of Object.entries(missing).sort()) {
    problems.push(
      `en "${k}" changed (${short(enBase[k], 50)} → ${short(en[k], 50)}) but these locales were not ` +
        `re-translated: ${ls.join(', ')}`,
    );
  }

  // No source-hashes.json at base: this branch introduces the ledger (seeded debt).
  const baseStale = baseData?.stale;
  for (const [l, entries] of Object.entries(baseStale ? head.stale : {})) {
    for (const lk of Object.keys(entries)) {
      if (!baseStale![l]?.[lk]) problems.push(`stale ledger grew: ${l}:${lk} (deferring a translation is not allowed)`);
    }
  }
  return problems;
}

function report() {
  const data = readSourceHashes();
  const { changed, removed } = unstamped(data);
  const strict = !!flags.strict || process.env.I18N_STALE_STRICT === '1';
  const onlyLocale = flag('locale');
  let exit = 0;
  const summary: string[] = ['## i18n stale translations', ''];

  if (changed.length || removed.length) {
    exit = 1;
    console.error(`✗ en.json changed but source-hashes.json was not stamped (${changed.length} changed/new, ${removed.length} removed):`);
    for (const k of changed) console.error(`  ${k}: ${short(en[k])}`);
    for (const k of removed) console.error(`  ${k}: (removed from en)`);
    console.error('  → run `npm run i18n:stamp`, then translate the listed locales, or `npm run i18n:ack -- <key> --reason "..."` for English-only edits.');
    summary.push(`**✗ ${changed.length + removed.length} en key(s) not stamped** — run \`npm run i18n:stamp\`.`, '');
  }

  if (flags.ci) {
    const problems = ratchet();
    if (problems.length) {
      exit = 1;
      console.error('✗ Stale translations introduced by this branch:');
      for (const p of problems) console.error(`  ${p}`);
      console.error(
        '  → translate the listed locales in this PR and run `npm run i18n:stamp`, or, if the English ' +
          'edit does not change meaning (typo, punctuation, casing), run ' +
          '`npm run i18n:ack -- <key> --reason "..."`.',
      );
      summary.push(`**✗ ${problems.length} stale-translation problem(s) introduced by this PR:**`, '');
      for (const p of problems) summary.push(`- ${p}`);
      summary.push('');
    } else {
      console.log('✓ This branch introduces no stale translations.');
    }
  }

  const ledger = Object.entries(data.stale).filter(([, e]) => Object.keys(e).length);
  const total = ledger.reduce((n, [, e]) => n + Object.keys(e).length, 0);
  if (total) {
    const counts = ledger.map(([l, e]) => `${l} ${Object.keys(e).length}`).join(', ');
    console.log(`Stale ledger (known debt, shrink-only): ${total} entries — ${counts}`);
    summary.push(`Stale ledger (known debt, shrink-only): **${total}** entries — ${counts}`, '');
    for (const [l, entries] of ledger) {
      if (onlyLocale && onlyLocale !== l) continue;
      const cur = readLocale(l);
      if (onlyLocale || flags.all) {
        for (const lk of Object.keys(entries)) {
          console.log(`  ${l}:${lk}\n      en: ${short(en[sourceKeyOf(lk, en)!])}\n      ${l}: ${short(cur[lk])}`);
        }
      }
    }
    if (!onlyLocale && !flags.all) console.log('  (list entries with --locale <code> or --all)');
    if (strict) {
      exit = 1;
      console.error('✗ Strict mode (I18N_STALE_STRICT=1): the stale ledger must be empty.');
    }
  } else {
    console.log('✓ Stale ledger is empty.');
  }
  if (!exit && !changed.length) console.log(`✓ All ${Object.keys(en).length} en keys stamped.`);

  if (flags.summary && process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
  }
  process.exit(exit);
}

switch (command) {
  case 'init':
    init();
    break;
  case 'stamp':
    stamp();
    break;
  case 'ack':
    ack();
    break;
  case 'report':
    report();
    break;
  default:
    console.error(`Unknown command "${command}" (report | stamp | ack | init)`);
    process.exit(2);
}
