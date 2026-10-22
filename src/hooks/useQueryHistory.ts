import { useState, useCallback } from 'react';
import type { TFunction } from 'i18next';
import { SavedQuery, QueryFilter } from '../types';

const STORAGE_KEY = 'lenr-query-history';
const MAX_HISTORY_SIZE = 50;

type QueryType = SavedQuery['queryType'];
const QUERY_TYPES: readonly QueryType[] = ['fusion', 'fission', 'twotwo'];

function isQueryType(value: unknown): value is QueryType {
  return typeof value === 'string' && (QUERY_TYPES as readonly string[]).includes(value);
}

function loadHistory(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Tolerate legacy/malformed entries: keep anything that is an object with an id
        return parsed.filter(
          (q): q is SavedQuery => !!q && typeof q === 'object' && typeof (q as SavedQuery).id === 'string'
        );
      }
    }
  } catch (error) {
    console.error('Failed to load query history:', error);
  }
  return [];
}

function saveHistory(queries: SavedQuery[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
  } catch (error) {
    console.error('Failed to save query history:', error);
  }
}

function filtersMatch(a: QueryFilter, b: QueryFilter): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Build the display label for a history entry in the current UI language.
 *
 * Labels are derived at render time from the structured params (queryType + filter)
 * so they follow language changes. Legacy entries (saved before labels were
 * localized) carry an English `name`; it is only used as a fallback when the
 * structured params are missing or unrecognized.
 */
export function getQueryLabel(query: Partial<SavedQuery>, t: TFunction): string {
  if (!isQueryType(query.queryType) || !query.filter || typeof query.filter !== 'object') {
    return query.name ?? '';
  }

  const filter = query.filter;
  const typeLabel = t(QUERY_TYPE_LABEL_KEYS[query.queryType]);
  const parts: string[] = [];

  if (filter.element1List?.length) {
    parts.push(filter.element1List.join(','));
  }
  if (filter.element2List?.length) {
    parts.push('+ ' + filter.element2List.join(','));
  }
  if (filter.elements?.length) {
    parts.push(filter.elements.join(','));
  }

  const elements = parts.length ? parts.join(' ') : t('queryHistory.allElements');
  return t('queryHistory.label', { type: typeLabel, elements });
}

/** i18n keys for the short query-type labels (badges, filter pills, history labels) */
export const QUERY_TYPE_LABEL_KEYS: Record<QueryType, string> = {
  fusion: 'queryHistory.filterFusion',
  fission: 'queryHistory.filterFission',
  twotwo: 'queryHistory.filterTwoToTwo',
};

export function useQueryHistory() {
  const [history, setHistory] = useState<SavedQuery[]>(loadHistory);

  const addToHistory = useCallback((
    queryType: 'fusion' | 'fission' | 'twotwo',
    filter: QueryFilter,
    resultCount?: number
  ) => {
    setHistory(prev => {
      // Check for duplicate - update timestamp if same query exists
      const existingIndex = prev.findIndex(
        q => q.queryType === queryType && filtersMatch(q.filter, filter)
      );

      let updated: SavedQuery[];

      if (existingIndex >= 0) {
        // Move to top and update timestamp/count
        const existing = prev[existingIndex];
        updated = [
          { ...existing, timestamp: Date.now(), resultCount },
          ...prev.filter((_, i) => i !== existingIndex),
        ];
      } else {
        // No display name is stored: labels are built at render time via getQueryLabel()
        const newQuery: SavedQuery = {
          id: crypto.randomUUID(),
          queryType,
          filter,
          timestamp: Date.now(),
          isBookmarked: false,
          resultCount,
        };
        updated = [newQuery, ...prev];
      }

      // Trim to max size, always keeping all bookmarks
      if (updated.length > MAX_HISTORY_SIZE) {
        const bookmarked = updated.filter(q => q.isBookmarked);
        const nonBookmarked = updated.filter(q => !q.isBookmarked);
        const nonBookmarkedToKeep = nonBookmarked.slice(0, Math.max(0, MAX_HISTORY_SIZE - bookmarked.length));
        updated = [...bookmarked, ...nonBookmarkedToKeep];
      }

      saveHistory(updated);
      return updated;
    });
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.map(q =>
        q.id === id ? { ...q, isBookmarked: !q.isBookmarked } : q
      );
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(q => q.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback((preserveBookmarks = true) => {
    setHistory(prev => {
      const updated = preserveBookmarks ? prev.filter(q => q.isBookmarked) : [];
      saveHistory(updated);
      return updated;
    });
  }, []);

  const getHistoryForType = useCallback((queryType: 'fusion' | 'fission' | 'twotwo') => {
    return history.filter(q => q.queryType === queryType);
  }, [history]);

  return {
    history,
    addToHistory,
    toggleBookmark,
    removeFromHistory,
    clearHistory,
    getHistoryForType,
  };
}
