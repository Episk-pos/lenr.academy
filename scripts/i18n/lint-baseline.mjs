#!/usr/bin/env node
// Shrink-only baseline gate for hard-coded UI copy (check 1a in CLAUDE.md → "i18n guardrails").
//
//   npm run lint:i18n:ci        # fail on any hard-coded string not in the baseline,
//                               # and on baseline entries that are gone (shrink the file)
//   npm run lint:i18n:baseline  # rewrite the baseline from the current code; refuses to
//                               # add or grow entries unless --allow-grow is passed
//
// Runs eslint-plugin-i18next with .eslintrc.i18n.cjs over src/**/*.{ts,tsx}. ESLint 8
// has no native suppressions, so violations are fingerprinted as
// `<file>::<exact literal>` and counted (line numbers would churn on every edit).
import { ESLint } from 'eslint';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = resolve(ROOT, 'src/i18n/hardcoded-baseline.json');
const args = new Set(process.argv.slice(2));
const update = args.has('--update');
const allowGrow = args.has('--allow-grow');

const eslint = new ESLint({
  cwd: ROOT,
  useEslintrc: false,
  overrideConfigFile: resolve(ROOT, '.eslintrc.i18n.cjs'),
  extensions: ['.ts', '.tsx'],
});
const results = await eslint.lintFiles(['src']);

const actual = {};
const where = {};
let fatal = 0;
for (const r of results) {
  const file = relative(ROOT, r.filePath);
  const lines = (r.source ?? readFileSync(r.filePath, 'utf8')).split('\n');
  for (const m of r.messages) {
    if (m.fatal) {
      fatal++;
      console.error(`${file}:${m.line} parse error: ${m.message}`);
      continue;
    }
    if (m.ruleId !== 'i18next/no-literal-string') continue;
    const endLine = m.endLine ?? m.line;
    const text =
      endLine === m.line
        ? lines[m.line - 1].slice(m.column - 1, m.endColumn - 1)
        : [
            lines[m.line - 1].slice(m.column - 1),
            ...lines.slice(m.line, endLine - 1),
            lines[endLine - 1].slice(0, m.endColumn - 1),
          ].join('\n');
    const fp = `${file}::${text.replace(/\s+/g, ' ').trim()}`;
    actual[fp] = (actual[fp] ?? 0) + 1;
    (where[fp] ??= []).push(`${file}:${m.line}:${m.column}`);
  }
}
if (fatal) process.exit(2);

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).entries : {};
const grown = Object.keys(actual).filter((fp) => actual[fp] > (baseline[fp] ?? 0));
const shrunk = Object.keys(baseline).filter((fp) => (actual[fp] ?? 0) < baseline[fp]);
const total = Object.values(actual).reduce((a, b) => a + b, 0);

if (update) {
  if (grown.length && !allowGrow) {
    console.error('Refusing to add hard-coded strings to the baseline (it only shrinks):');
    for (const fp of grown) console.error(`  ${where[fp].join(', ')}  ${fp.split('::')[1]}`);
    console.error('Wrap them in t() instead. To override deliberately, pass --allow-grow.');
    process.exit(1);
  }
  const entries = Object.fromEntries(Object.keys(actual).sort().map((fp) => [fp, actual[fp]]));
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        version: 1,
        description:
          'Known hard-coded UI strings (eslint-plugin-i18next). Shrink-only: fix one, then run `npm run lint:i18n:baseline`.',
        entries,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${Object.keys(entries).length} entries (${total} occurrences) to ${relative(ROOT, BASELINE)}`);
  process.exit(0);
}

let failed = false;
if (grown.length) {
  failed = true;
  console.error('✗ New hard-coded user-facing strings — wrap them in t() and add keys to every locale:');
  for (const fp of grown) {
    const extra = actual[fp] - (baseline[fp] ?? 0);
    console.error(`  ${where[fp].join(', ')}  ${JSON.stringify(fp.split('::')[1])}${extra > 1 ? ` (+${extra})` : ''}`);
  }
}
if (shrunk.length) {
  failed = true;
  console.error('✗ These baselined hard-coded strings are gone — run `npm run lint:i18n:baseline` to shrink the baseline:');
  for (const fp of shrunk) console.error(`  ${fp} (baseline ${baseline[fp]}, now ${actual[fp] ?? 0})`);
}
if (failed) process.exit(1);
console.log(`✓ No new hard-coded strings (${total} baselined occurrences in ${Object.keys(actual).length} entries).`);
