import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AllQueryStates, QueryPageState } from '../types';

const STORAGE_KEY_PREFIX = 'lenr-query-states';
const TAB_ID_KEY = 'lenr-tab-id';
const CURRENT_VERSION = 1;

// Generate or get a unique tab ID that persists during navigation within the same tab
function getTabId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

interface QueryStateContextType {
  queryStates: AllQueryStates;
  updateFusionState: (state: Partial<QueryPageState>) => void;
  updateFissionState: (state: Partial<QueryPageState>) => void;
  updateTwoToTwoState: (state: Partial<QueryPageState>) => void;
  getFusionState: () => QueryPageState | undefined;
  getFissionState: () => QueryPageState | undefined;
  getTwoToTwoState: () => QueryPageState | undefined;
  clearAllStates: () => void;
  clearPageState: (page: 'fusion' | 'fission' | 'twotwo') => void;
}

const QueryStateContext = createContext<QueryStateContextType | undefined>(undefined);

export function QueryStateProvider({ children }: { children: ReactNode }) {
  // Get or create a unique tab ID
  const tabId = useRef(getTabId());
  const storageKey = `${STORAGE_KEY_PREFIX}-${tabId.current}`;

  const [queryStates, setQueryStates] = useState<AllQueryStates>(() => {
    // Try to load from localStorage using tab-specific key
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check version for future migration support
        if (parsed.version === CURRENT_VERSION) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load query states from localStorage:', error);
    }

    // Return default empty state
    return {
      version: CURRENT_VERSION,
      fusion: undefined,
      fission: undefined,
      twotwo: undefined,
    };
  });

  // Save to localStorage whenever queryStates changes using tab-specific key
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(queryStates));
    } catch (error) {
      console.error('Failed to save query states to localStorage:', error);
    }
  }, [queryStates, storageKey]);

  // Cleanup old tab states on mount (remove states older than 7 days)
  useEffect(() => {
    try {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX) && key !== storageKey) {
          // Extract timestamp from key if possible
          const match = key.match(/tab-(\d+)-/);
          if (match) {
            const timestamp = parseInt(match[1], 10);
            if (now - timestamp > maxAge) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old query states:', error);
    }
  }, []); // Only run once on mount

  const updateFusionState = useCallback((state: Partial<QueryPageState>) => {
    setQueryStates(prev => ({
      ...prev,
      fusion: {
        ...prev.fusion,
        ...state,
        filter: {
          ...prev.fusion?.filter,
          ...state.filter,
        },
        visualization: {
          ...prev.fusion?.visualization,
          ...state.visualization,
        },
        lastUpdated: Date.now(),
      } as QueryPageState,
    }));
  }, []);

  const updateFissionState = useCallback((state: Partial<QueryPageState>) => {
    setQueryStates(prev => ({
      ...prev,
      fission: {
        ...prev.fission,
        ...state,
        filter: {
          ...prev.fission?.filter,
          ...state.filter,
        },
        visualization: {
          ...prev.fission?.visualization,
          ...state.visualization,
        },
        lastUpdated: Date.now(),
      } as QueryPageState,
    }));
  }, []);

  const updateTwoToTwoState = useCallback((state: Partial<QueryPageState>) => {
    setQueryStates(prev => ({
      ...prev,
      twotwo: {
        ...prev.twotwo,
        ...state,
        filter: {
          ...prev.twotwo?.filter,
          ...state.filter,
        },
        visualization: {
          ...prev.twotwo?.visualization,
          ...state.visualization,
        },
        lastUpdated: Date.now(),
      } as QueryPageState,
    }));
  }, []);

  const getFusionState = useCallback(() => queryStates.fusion, [queryStates.fusion]);
  const getFissionState = useCallback(() => queryStates.fission, [queryStates.fission]);
  const getTwoToTwoState = useCallback(() => queryStates.twotwo, [queryStates.twotwo]);

  const clearAllStates = useCallback(() => {
    setQueryStates({
      version: CURRENT_VERSION,
      fusion: undefined,
      fission: undefined,
      twotwo: undefined,
    });
  }, []);

  const clearPageState = useCallback((page: 'fusion' | 'fission' | 'twotwo') => {
    setQueryStates(prev => ({
      ...prev,
      [page]: undefined,
    }));
  }, []);

  const contextValue: QueryStateContextType = {
    queryStates,
    updateFusionState,
    updateFissionState,
    updateTwoToTwoState,
    getFusionState,
    getFissionState,
    getTwoToTwoState,
    clearAllStates,
    clearPageState,
  };

  return (
    <QueryStateContext.Provider value={contextValue}>
      {children}
    </QueryStateContext.Provider>
  );
}

export function useQueryState() {
  const context = useContext(QueryStateContext);
  if (context === undefined) {
    throw new Error('useQueryState must be used within a QueryStateProvider');
  }
  return context;
}