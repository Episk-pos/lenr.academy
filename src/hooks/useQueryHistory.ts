import { useState, useCallback } from 'react';
import { SavedQuery, QueryFilter } from '../types';

const STORAGE_KEY = 'lenr-query-history';
const MAX_HISTORY_SIZE = 50;

function loadHistory(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
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

function generateName(queryType: string, filter: QueryFilter): string {
  const parts: string[] = [];

  const typeLabel = queryType === 'twotwo' ? '2→2' : queryType.charAt(0).toUpperCase() + queryType.slice(1);
  parts.push(typeLabel);

  if (filter.element1List?.length) {
    parts.push(filter.element1List.join(','));
  }
  if (filter.element2List?.length) {
    parts.push('+ ' + filter.element2List.join(','));
  }
  if (filter.elements?.length) {
    parts.push(filter.elements.join(','));
  }

  if (parts.length === 1) {
    parts.push('All elements');
  }

  return parts.join(' ');
}

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
        const newQuery: SavedQuery = {
          id: crypto.randomUUID(),
          name: generateName(queryType, filter),
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
