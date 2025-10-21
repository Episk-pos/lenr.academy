import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AllQueryStates, QueryPageState } from '../types';

const STORAGE_KEY = 'lenr-query-states';
const CURRENT_VERSION = 1;

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
  const [queryStates, setQueryStates] = useState<AllQueryStates>(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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

  // Save to localStorage whenever queryStates changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queryStates));
    } catch (error) {
      console.error('Failed to save query states to localStorage:', error);
    }
  }, [queryStates]);

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