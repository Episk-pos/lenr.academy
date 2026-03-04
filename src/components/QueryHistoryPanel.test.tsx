import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

// Import after mocks are set up
import QueryHistoryPanel from './QueryHistoryPanel';
import type { SavedQuery } from '../types';

const baseQuery: SavedQuery = {
  id: '1',
  name: 'H + Li fusion',
  queryType: 'fusion',
  filter: {
    element1List: ['H'],
    element2List: ['Li'],
  },
  timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
  resultCount: 10,
  isBookmarked: false,
};

function renderAndOpen(history: SavedQuery[], overrides: Partial<Parameters<typeof QueryHistoryPanel>[0]> = {}) {
  const result = render(
    <QueryHistoryPanel
      history={history}
      currentQueryType="fusion"
      onLoadQuery={vi.fn()}
      onToggleBookmark={vi.fn()}
      onRemove={vi.fn()}
      onClearHistory={vi.fn()}
      {...overrides}
    />
  );
  // Open the dropdown by clicking the toggle button
  if (history.length > 0) {
    const toggleBtn = screen.getByTitle(/history/i);
    fireEvent.click(toggleBtn);
  }
  return result;
}

describe('QueryHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no history', () => {
    const { container } = render(
      <QueryHistoryPanel
        history={[]}
        currentQueryType="fusion"
        onLoadQuery={vi.fn()}
        onToggleBookmark={vi.fn()}
        onRemove={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows toggle button with history count', () => {
    render(
      <QueryHistoryPanel
        history={[baseQuery]}
        currentQueryType="fusion"
        onLoadQuery={vi.fn()}
        onToggleBookmark={vi.fn()}
        onRemove={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('shows history items after opening dropdown', () => {
    renderAndOpen([baseQuery]);
    expect(screen.getByText(/E1: H/)).toBeInTheDocument();
  });

  it('shows type badge for query', () => {
    renderAndOpen([baseQuery]);
    // Badge is in a small span with rounded-full class
    const badges = screen.getAllByText('Fusion');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onToggleBookmark when bookmark button clicked', () => {
    const onToggleBookmark = vi.fn();
    renderAndOpen([baseQuery], { onToggleBookmark });
    const bookmarkBtn = screen.getByTitle('Bookmark');
    fireEvent.click(bookmarkBtn);
    expect(onToggleBookmark).toHaveBeenCalledWith('1');
  });

  it('calls onRemove when delete button clicked', () => {
    const onRemove = vi.fn();
    renderAndOpen([baseQuery], { onRemove });
    const deleteBtn = screen.getByTitle('Remove');
    fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('shows bookmarked items with "Remove bookmark" title', () => {
    const bookmarkedQuery = { ...baseQuery, isBookmarked: true };
    renderAndOpen([bookmarkedQuery]);
    expect(screen.getByTitle('Remove bookmark')).toBeInTheDocument();
  });

  it('calls onClearHistory when clear button clicked', () => {
    const onClearHistory = vi.fn();
    renderAndOpen([baseQuery], { onClearHistory });
    const clearBtn = screen.getByText(/clear/i);
    fireEvent.click(clearBtn);
    expect(onClearHistory).toHaveBeenCalledOnce();
  });

  it('shows result count', () => {
    renderAndOpen([baseQuery]);
    expect(screen.getByText(/10 results/)).toBeInTheDocument();
  });

  it('shows time ago for recent queries', () => {
    renderAndOpen([baseQuery]);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });
});
