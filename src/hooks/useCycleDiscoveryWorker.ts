import { useState, useRef, useCallback, useEffect } from 'react';
import type { CycleDiscoveryParameters, CycleDiscoveryResults, CycleDiscoveryProgress } from '../types';
import type {
  CycleDiscoveryRunRequest,
  CycleDiscoveryCancelRequest,
  CycleDiscoveryWorkerResponse,
  CycleDiscoveryProgressMessage,
} from '../workers/cycleDiscoveryWorker';

export interface UseCycleDiscoveryWorkerReturn {
  runDiscovery: (params: CycleDiscoveryParameters, dbBuffer: ArrayBuffer) => Promise<CycleDiscoveryResults>;
  cancelDiscovery: () => void;
  progress: CycleDiscoveryProgress | null;
  isRunning: boolean;
  error: string | null;
}

/**
 * Hook to manage cycle discovery in a Web Worker
 *
 * Provides progress tracking, cancellation, and error handling
 * for long-running cycle discovery searches.
 */
export function useCycleDiscoveryWorker(): UseCycleDiscoveryWorkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<CycleDiscoveryProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((results: CycleDiscoveryResults) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    // Create worker using Vite's worker import syntax
    const worker = new Worker(
      new URL('../workers/cycleDiscoveryWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<CycleDiscoveryWorkerResponse>) => {
      const message = event.data;

      // Ignore stale messages from a cancelled run
      if (!resolveRef.current && !rejectRef.current) return;

      if (message.type === 'progress') {
        const progressMsg = message as CycleDiscoveryProgressMessage;
        setProgress(progressMsg.progress);
      } else if (message.type === 'complete') {
        setIsRunning(false);
        setProgress(null);
        setError(null);

        if (resolveRef.current) {
          resolveRef.current(message.results);
          resolveRef.current = null;
          rejectRef.current = null;
        }
      } else if (message.type === 'error') {
        setIsRunning(false);
        setProgress(null);
        setError(message.error);

        if (rejectRef.current) {
          rejectRef.current(new Error(message.error));
          resolveRef.current = null;
          rejectRef.current = null;
        }
      }
    };

    worker.onerror = (event) => {
      setIsRunning(false);
      setProgress(null);
      const errorMsg = event.message || 'Worker error occurred';
      setError(errorMsg);

      if (rejectRef.current) {
        rejectRef.current(new Error(errorMsg));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    };

    workerRef.current = worker;

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const runDiscovery = useCallback(
    (params: CycleDiscoveryParameters, dbBuffer: ArrayBuffer): Promise<CycleDiscoveryResults> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        if (isRunning) {
          reject(new Error('Cycle discovery already running'));
          return;
        }

        setIsRunning(true);
        setProgress({
          phase: 'building_graph',
          cyclesFound: 0,
          fuelCombinationsChecked: 0,
          totalCombinations: 0,
          percentage: 0,
        });
        setError(null);

        resolveRef.current = resolve;
        rejectRef.current = reject;

        const message: CycleDiscoveryRunRequest = {
          type: 'run',
          params,
          dbBuffer,
        };

        workerRef.current.postMessage(message);
      });
    },
    [isRunning]
  );

  const cancelDiscovery = useCallback(() => {
    if (workerRef.current && isRunning) {
      const cancelMsg: CycleDiscoveryCancelRequest = { type: 'cancel' };
      workerRef.current.postMessage(cancelMsg);
      setIsRunning(false);
      setProgress(null);
      setError('Discovery cancelled');

      if (rejectRef.current) {
        rejectRef.current(new Error('Cycle discovery cancelled by user'));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    }
  }, [isRunning]);

  return {
    runDiscovery,
    cancelDiscovery,
    progress,
    isRunning,
    error,
  };
}
