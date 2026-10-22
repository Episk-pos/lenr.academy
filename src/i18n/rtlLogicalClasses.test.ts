/**
 * RTL regression guard: direction-dependent Tailwind utilities must use their
 * logical equivalents (ms/me, ps/pe, start/end, text-start/end, border-s/e,
 * rounded-s/e, gap instead of space-x) so the layout mirrors for Arabic.
 *
 * Physical utilities are only allowed where the geometry is intentionally
 * left-to-right regardless of language (periodic table grid, chart overlays,
 * nuclide notation, centring with -translate-x-1/2). Those live in ALLOWLIST
 * with a reason; anything else fails this test.
 */
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob(['../**/*.{ts,tsx,css}', '!../**/*.test.{ts,tsx}', '!../test-utils/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PHYSICAL =
  /^(?:(?:m|p|scroll-m|scroll-p)[lr]|left|right)-(?:\d+(?:\.\d+)?|px|auto|full|\d\/\d|\[[^\]]+\])$|^text-(?:left|right)$|^border-[lr](?:-.+)?$|^rounded-(?:l|r|tl|tr|bl|br)(?:-.+)?$|^space-x-.+$/;

/** file (relative to src/) -> physical utilities that are intentionally kept, with the reason */
const ALLOWLIST: Record<string, { tokens: string[]; reason: string }> = {
  'components/PeriodicTable.tsx': {
    tokens: ['right-0', 'pr-1', 'pr-3', 'pr-6', 'ml-[5.625rem]', 'ml-[9.75rem]'],
    reason: 'periodic table grid geometry; the table renders inside dir="ltr"',
  },
  'components/PeriodicTableSelector.tsx': {
    tokens: ['left-1/2', 'right-0'],
    reason: 'centring via -translate-x-1/2, and the scroll fade over the dir="ltr" periodic table scroller',
  },
  'components/CycleVisualization.tsx': {
    tokens: ['left-1/2', 'mr-0.5'],
    reason: 'labels centred with -translate-x-1/2; mass-number superscript in dir="ltr" nuclide notation',
  },
  'components/CycleResultsTable.tsx': {
    tokens: ['mr-0.5'],
    reason: 'mass-number superscript in dir="ltr" nuclide notation',
  },
  'components/CascadeNetworkDiagram.tsx': {
    tokens: ['right-4'],
    reason: 'zoom controls overlaying the dir="ltr" D3 network chart',
  },
};

function physicalTokens(source: string): string[] {
  const found = new Set<string>();
  for (const raw of source.split(/[\s"'`{}()$,;]+/)) {
    if (!raw) continue;
    // Strip variant prefixes (sm:, dark:, rtl:, hover: ...), important and negative markers
    const util = raw.split(':').pop()!.replace(/^!/, '').replace(/^-/, '');
    if (PHYSICAL.test(util)) found.add(util);
  }
  return [...found];
}

const scanned = Object.entries(sources).map(([path, source]) => ({
  file: path.replace(/^\.\.\//, ''),
  tokens: physicalTokens(source),
}));

describe('RTL: logical Tailwind utilities', () => {
  it('scans the application sources', () => {
    expect(scanned.length).toBeGreaterThan(50);
    expect(scanned.some((s) => s.file === 'components/Layout.tsx')).toBe(true);
  });

  it('uses no physical direction utilities outside the allowlist', () => {
    const violations = scanned.flatMap(({ file, tokens }) => {
      const allowed = ALLOWLIST[file]?.tokens ?? [];
      return tokens.filter((tok) => !allowed.includes(tok)).map((tok) => `${file}: ${tok}`);
    });
    expect(violations, 'use ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e or gap').toEqual([]);
  });

  it('has no stale allowlist entries', () => {
    const stale = Object.entries(ALLOWLIST).flatMap(([file, { tokens }]) => {
      const present = scanned.find((s) => s.file === file)?.tokens ?? [];
      return tokens.filter((tok) => !present.includes(tok)).map((tok) => `${file}: ${tok}`);
    });
    expect(stale).toEqual([]);
  });
});
