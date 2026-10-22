/**
 * Regression tests for hardcoded English in shared query-page components (beads-7z7).
 *
 * These render with a REAL i18next instance (not the English-only mock) in non-English
 * languages. Keys that a locale has not translated yet are filled with pseudo-localized
 * markers (see createTestI18n({ pseudoFillMissing: true })) rather than falling back to
 * English, so any English text that still shows up must be hardcoded in the component.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import PeriodicTableSelector from './PeriodicTableSelector';
import QueryHistoryPanel from './QueryHistoryPanel';
import { getQueryLabel } from '../hooks/useQueryHistory';
import { createTestI18n } from '../test-utils/i18nInstance';
import type { Element, SavedQuery } from '../types';

const ELEMENTS = [
  { Z: 1, E: 'H', EName: 'Hydrogen', Period: 1, Group: 1 },
  { Z: 3, E: 'Li', EName: 'Lithium', Period: 2, Group: 1 },
  { Z: 28, E: 'Ni', EName: 'Nickel', Period: 4, Group: 10 },
] as Element[];

const HISTORY: SavedQuery[] = [
  {
    // New-style entry: structured params only, label built at render time
    id: 'q1',
    queryType: 'fusion',
    filter: {},
    timestamp: Date.now() - 5 * 1000,
    resultCount: 12,
    isBookmarked: false,
  },
  {
    id: 'q2',
    queryType: 'fission',
    filter: { elements: ['Pd'], limit: 100 },
    timestamp: Date.now() - 2 * 60 * 1000,
    resultCount: 1,
    isBookmarked: true,
  },
];

function renderSelector(i18n: I18nInstance, selected: string[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <PeriodicTableSelector
        label="E1"
        availableElements={ELEMENTS}
        selectedElements={selected}
        onSelectionChange={vi.fn()}
      />
    </I18nextProvider>
  );
}

function renderHistory(i18n: I18nInstance, history: SavedQuery[] = HISTORY) {
  const result = render(
    <I18nextProvider i18n={i18n}>
      <QueryHistoryPanel
        history={history}
        currentQueryType="fusion"
        onLoadQuery={vi.fn()}
        onToggleBookmark={vi.fn()}
        onRemove={vi.fn()}
        onClearHistory={vi.fn()}
      />
    </I18nextProvider>
  );
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  return result;
}

/** Rendered text without inline <style> blocks (CSS selectors are not UI text) */
function visibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style, script').forEach((el) => el.remove());
  return clone.textContent ?? '';
}

const FORBIDDEN_ENGLISH = ['Any', 'Clear all', 'selected:', 'just now', 'All elements', ' results', ' result', 'limit:', 'ago'];

describe.each(['de', 'hi'])('no hardcoded English (%s)', (lng) => {
  it('PeriodicTableSelector: empty state', async () => {
    const i18n = await createTestI18n(lng, { pseudoFillMissing: true });
    const { container } = renderSelector(i18n, []);
    for (const s of FORBIDDEN_ENGLISH) expect(visibleText(container)).not.toContain(s);
  });

  it('PeriodicTableSelector: with a selection', async () => {
    const i18n = await createTestI18n(lng, { pseudoFillMissing: true });
    const { container } = renderSelector(i18n, ['H', 'Li']);
    for (const s of FORBIDDEN_ENGLISH) expect(visibleText(container)).not.toContain(s);
    // Remove buttons are labelled in the active language
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('aria-label') ?? '').not.toMatch(/^Remove /);
    }
  });

  it('QueryHistoryPanel', async () => {
    const i18n = await createTestI18n(lng, { pseudoFillMissing: true });
    const { container } = renderHistory(i18n);
    for (const s of FORBIDDEN_ENGLISH) expect(visibleText(container)).not.toContain(s);
    // Relative time comes from Intl in the active language
    expect(container.textContent).toContain(new Intl.RelativeTimeFormat(lng, { numeric: 'auto' }).format(0, 'second'));
    expect(container.textContent).toContain(new Intl.RelativeTimeFormat(lng, { numeric: 'auto' }).format(-2, 'minute'));
    for (const el of container.querySelectorAll('[title],[aria-label]')) {
      for (const attr of ['title', 'aria-label']) {
        expect(el.getAttribute(attr) ?? '').not.toMatch(/^(Remove|Bookmark|Close)/);
      }
    }
  });
});

describe('query history labels follow the UI language', () => {
  it('relabels an entry after changing the language', async () => {
    const i18n = await createTestI18n('en', { pseudoFillMissing: true });
    const { container } = renderHistory(i18n, [HISTORY[0]]);
    expect(container.textContent).toContain('Fusion All elements');
    expect(container.textContent).toContain('12 results');

    await act(async () => {
      await i18n.changeLanguage('hi');
    });

    expect(container.textContent).not.toContain('All elements');
    expect(container.textContent).not.toContain('12 results');
    expect(container.textContent).toContain(i18n.t('queryHistory.allElements'));
  });

  it('builds labels from structured params via t()', async () => {
    const en = await createTestI18n('en');
    expect(getQueryLabel({ queryType: 'fusion', filter: { element1List: ['H'], element2List: ['Li'] } }, en.t)).toBe('Fusion H + Li');
    expect(getQueryLabel({ queryType: 'twotwo', filter: { element1List: ['D'], element2List: ['Ni'] } }, en.t)).toBe('2→2 D + Ni');
    expect(getQueryLabel({ queryType: 'fission', filter: {} }, en.t)).toBe('Fission All elements');
  });

  it('regenerates legacy entries that have structured params, keeps label-only ones', async () => {
    const de = await createTestI18n('de', { pseudoFillMissing: true });
    // Legacy entry with an English name AND params: the label is rebuilt in the UI language
    expect(getQueryLabel({ name: 'Fusion All elements', queryType: 'fusion', filter: {} }, de.t)).not.toContain('All elements');
    // Legacy entry with only a label (no usable params): the stored label is shown as-is
    expect(getQueryLabel({ name: 'Fusion H + Li' }, de.t)).toBe('Fusion H + Li');
    expect(getQueryLabel({ name: 'Custom', queryType: 'bogus' as SavedQuery['queryType'], filter: {} }, de.t)).toBe('Custom');
  });

  it('renders a legacy label-only entry from localStorage-era data', async () => {
    const de = await createTestI18n('de', { pseudoFillMissing: true });
    const legacy = { id: 'old', name: 'Fusion Ni + H', timestamp: Date.now(), isBookmarked: false } as unknown as SavedQuery;
    renderHistory(de, [legacy]);
    expect(screen.getByText('Fusion Ni + H')).toBeInTheDocument();
  });
});
