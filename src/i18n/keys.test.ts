// Undefined-key guard (check 2b in CLAUDE.md → "i18n guardrails").
//
// Scans non-test sources under src/ with the TypeScript compiler API and requires
// every statically known i18n key to exist in en.json:
//   - the first argument of t(...) / x.t(...) when it is a plain string literal
//   - <Trans i18nKey="..."> attributes
//   - key-shaped string values of object properties named *Key / i18nKey, and the
//     elements of *Keys arrays (labelKey: 'nav.home', contentKeys: [...])
// `i18nKey` props on data rows are prefixes (`${i18nKey}.term`), so any en key
// under the prefix counts. Dynamic keys (t(`citations.entries.${id}.title`)) are
// verified by dataTables.test.ts, which enumerates the ids.
//
// Manual cross-check for the t() half:
//   npx @lingual/i18n-check -l src/i18n/locales -s en -f i18next -o undefined -u src
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import en from './locales/en.json';
import { flatten } from './tooling';

const ROOT = resolve(__dirname, '../..');
const SRC = resolve(ROOT, 'src');

// Explicitly skipped files. Keep each entry commented with its follow-up.
const SKIP_FILES = new Set([
  // Unmounted component (only its own test imports it); its 27 russellHistory.* keys
  // were never added to en.json. Follow-up bead beads-h7m: translate or delete it.
  'src/components/RussellHistoricalContext.tsx',
]);

const KEY_LIKE = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;

const enFlat = flatten(en as Record<string, unknown>);
const enKeys = Object.keys(enFlat);

function isDefined(key: string, prefix: boolean): boolean {
  if (key in enFlat || `${key}_one` in enFlat || `${key}_other` in enFlat) return true;
  return prefix && enKeys.some((k) => k.startsWith(`${key}.`));
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function stringValue(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

interface Use {
  key: string;
  where: string;
  prefix: boolean;
}

function collectKeyUses(): { uses: Use[]; files: number } {
  const files = walk(SRC)
    .map((f) => relative(ROOT, f))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('src/test/'))
    .filter((f) => !SKIP_FILES.has(f));
  const uses: Use[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      readFileSync(resolve(ROOT, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const add = (key: string, node: ts.Node, prefix = false) =>
      uses.push({
        key,
        prefix,
        where: `${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
      });
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : '';
        const key = stringValue(node.arguments[0]);
        if (name === 't' && key !== undefined) add(key, node);
      } else if (ts.isJsxAttribute(node) && node.name.getText() === 'i18nKey') {
        const key = stringValue(node.initializer);
        if (key !== undefined) add(key, node);
      } else if (ts.isPropertyAssignment(node)) {
        const prop = node.name.getText();
        const key = stringValue(node.initializer);
        if (/(^i18nKey|Key)$/.test(prop) && key !== undefined && KEY_LIKE.test(key)) {
          add(key, node, prop === 'i18nKey');
        }
        if (/Keys$/.test(prop) && ts.isArrayLiteralExpression(node.initializer)) {
          for (const el of node.initializer.elements) {
            const k = stringValue(el);
            if (k !== undefined && KEY_LIKE.test(k)) add(k, el);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { uses, files: files.length };
}

describe('i18n keys used in code exist in en.json', () => {
  const { uses, files } = collectKeyUses();

  it('scans the sources', () => {
    expect(files).toBeGreaterThan(100);
    expect(uses.length).toBeGreaterThan(1000);
  });

  it('every static t() key, i18nKey and *Key data value is defined in en.json', () => {
    const undefinedKeys = uses
      .filter((u) => !isDefined(u.key, u.prefix))
      .map((u) => `${u.where} ${u.key}`);
    expect(
      undefinedKeys,
      'add these keys to src/i18n/locales/en.json and every other locale',
    ).toEqual([]);
  });

  it('skipped files still exist (drop stale SKIP_FILES entries)', () => {
    const all = new Set(walk(SRC).map((f) => relative(ROOT, f)));
    expect([...SKIP_FILES].filter((f) => !all.has(f))).toEqual([]);
  });
});
