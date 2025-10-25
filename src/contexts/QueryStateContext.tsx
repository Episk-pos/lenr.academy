import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AllQueryStates, QueryPageState, CascadePageState } from '../types';

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
  updateCascadeState: (state: Partial<CascadePageState>) => void;
  getFusionState: () => QueryPageState | undefined;
  getFissionState: () => QueryPageState | undefined;
  getTwoToTwoState: () => QueryPageState | undefined;
  getCascadeState: () => CascadePageState | undefined;
  clearAllStates: () => void;
  clearPageState: (page: 'fusion' | 'fission' | 'twotwo' | 'cascade') => void;
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
      cascade: undefined,
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

  const updateCascadeState = useCallback((state: Partial<CascadePageState>) => {
    setQueryStates(prev => {
      // Handle Map serialization for results.productDistribution
      let processedState = { ...state };

      if (state.results) {
        processedState = {
          ...state,
          results: {
            ...state.results,
            // Convert Map to array for JSON serialization
            productDistribution: state.results.productDistribution instanceof Map
              ? Array.from(state.results.productDistribution.entries()) as any
              : state.results.productDistribution,
          },
        };
      }

      return {
        ...prev,
        cascade: {
          ...prev.cascade,
          ...processedState,
          lastUpdated: Date.now(),
        } as CascadePageState,
      };
    });
  }, []);

  const getFusionState = useCallback(() => queryStates.fusion, [queryStates.fusion]);
  const getFissionState = useCallback(() => queryStates.fission, [queryStates.fission]);
  const getTwoToTwoState = useCallback(() => queryStates.twotwo, [queryStates.twotwo]);
  const getCascadeState = useCallback(() => {
    const state = queryStates.cascade;
    if (!state) return undefined;

    // Convert productDistribution array back to Map if needed
    if (state.results && Array.isArray(state.results.productDistribution)) {
      return {
        ...state,
        results: {
          ...state.results,
          productDistribution: new Map(state.results.productDistribution as any),
        },
      } as CascadePageState;
    }

    return state;
  }, [queryStates.cascade]);

  const clearAllStates = useCallback(() => {
    setQueryStates({
      version: CURRENT_VERSION,
      fusion: undefined,
      fission: undefined,
      twotwo: undefined,
      cascade: undefined,
    });
  }, []);

  const clearPageState = useCallback((page: 'fusion' | 'fission' | 'twotwo' | 'cascade') => {
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
    updateCascadeState,
    getFusionState,
    getFissionState,
    getTwoToTwoState,
    getCascadeState,
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