import { useState, useRef, useCallback, useEffect } from 'react';
import type { MullerResonancePair, ReactionOverlap, NAEPrediction } from '../services/mullerResonanceService';
import type { MullerWorkerRequest, MullerWorkerResponse } from '../workers/mullerWorker';

export interface UseMullerWorkerReturn {
  initialize: (dbBuffer: ArrayBuffer, elements: Array<{ Z: number; E: string }>) => void
  selectElement: (
    selectedZ: number,
    selectedSymbol: string,
    elements: Array<{ Z: number; E: string }>,
    threshold: number
  ) => void
  clearElement: () => void
  // Init results
  globalPairs: MullerResonancePair[]
  globalOverlaps: ReactionOverlap[]
  naePredictions: NAEPrediction[]
  reactionCounts: Map<number, number>
  isInitialized: boolean
  // Selection results
  pairs: MullerResonancePair[]
  overlaps: ReactionOverlap[]
  // Loading states
  isLoading: boolean
  error: string | null
}

/**
 * Hook to run Muller resonance computations in a Web Worker for non-blocking UI.
 *
 * Usage:
 * 1. Call initialize() with dbBuffer and elements after database loads
 * 2. Call selectElement() when user picks an element on the periodic table
 * 3. Call clearElement() to reset selection state
 */
export function useMullerWorker(): UseMullerWorkerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Init results
  const [globalPairs, setGlobalPairs] = useState<MullerResonancePair[]>([]);
  const [globalOverlaps, setGlobalOverlaps] = useState<ReactionOverlap[]>([]);
  const [naePredictions, setNaePredictions] = useState<NAEPrediction[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Map<number, number>>(new Map());

  // Selection results
  const [pairs, setPairs] = useState<MullerResonancePair[]>([]);
  const [overlaps, setOverlaps] = useState<ReactionOverlap[]>([]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/mullerWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<MullerWorkerResponse>) => {
      const message = event.data;

      if (message.type === 'initComplete') {
        setGlobalPairs(message.globalPairs);
        setGlobalOverlaps(message.globalOverlaps);
        setNaePredictions(message.naePredictions);
        setReactionCounts(new Map(message.reactionCounts));
        setIsInitialized(true);
        setIsLoading(false);
        setError(null);
      } else if (message.type === 'selectElementComplete') {
        setPairs(message.pairs);
        setOverlaps(message.overlaps);
        setIsLoading(false);
        setError(null);
      } else if (message.type === 'clearElementComplete') {
        setPairs([]);
        setOverlaps([]);
        setIsLoading(false);
        setError(null);
      } else if (message.type === 'error') {
        setIsLoading(false);
        setError(message.error);
      }
    };

    worker.onerror = (event) => {
      setIsLoading(false);
      setError(event.message || 'Muller worker error');
    };

    workerRef.current = worker;

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const initialize = useCallback(
    (dbBuffer: ArrayBuffer, elements: Array<{ Z: number; E: string }>) => {
      if (!workerRef.current) return;

      setIsLoading(true);
      setError(null);

      const message: MullerWorkerRequest = {
        type: 'init',
        dbBuffer,
        elements,
      };

      workerRef.current.postMessage(message, [message.dbBuffer]);
    },
    []
  );

  const selectElement = useCallback(
    (
      selectedZ: number,
      selectedSymbol: string,
      elements: Array<{ Z: number; E: string }>,
      threshold: number
    ) => {
      if (!workerRef.current) return;

      setIsLoading(true);
      setError(null);

      const message: MullerWorkerRequest = {
        type: 'selectElement',
        selectedZ,
        selectedSymbol,
        elements,
        threshold,
      };

      workerRef.current.postMessage(message);
    },
    []
  );

  const clearElement = useCallback(() => {
    if (!workerRef.current) return;

    setIsLoading(true);
    setError(null);

    const message: MullerWorkerRequest = {
      type: 'clearElement',
    };

    workerRef.current.postMessage(message);
  }, []);

  return {
    initialize,
    selectElement,
    clearElement,
    globalPairs,
    globalOverlaps,
    naePredictions,
    reactionCounts,
    isInitialized,
    pairs,
    overlaps,
    isLoading,
    error,
  };
}
