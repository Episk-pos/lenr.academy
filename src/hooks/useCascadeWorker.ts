import { useState, useRef, useCallback, useEffect } from 'react';
import type { CascadeParameters, CascadeResults } from '../types';
import type {
  CascadeWorkerRequest,
  CascadeWorkerResponse,
  CascadeProgressMessage,
} from '../workers/cascadeWorker';

export interface CascadeProgress {
  loop: number;
  totalLoops: number;
  newReactionsCount: number;
  percentage: number;
  newReactions?: any[];  // Incremental reactions for real-time visualization
}

export interface UseCascadeWorkerReturn {
  runCascade: (params: CascadeParameters, dbBuffer: ArrayBuffer) => Promise<CascadeResults>;
  cancelCascade: () => void;
  progress: CascadeProgress | null;
  isRunning: boolean;
  error: string | null;
}

/**
 * Hook to manage cascade simulation in a Web Worker
 *
 * Provides progress tracking, cancellation, and error handling
 * for long-running cascade simulations.
 */
export function useCascadeWorker(): UseCascadeWorkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<CascadeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((results: CascadeResults) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    // Create worker using Vite's worker import syntax
    const worker = new Worker(
      new URL('../workers/cascadeWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<CascadeWorkerResponse>) => {
      const message = event.data;

      if (message.type === 'progress') {
        const progressMsg = message as CascadeProgressMessage;
        setProgress({
          loop: progressMsg.loop,
          totalLoops: progressMsg.totalLoops,
          newReactionsCount: progressMsg.newReactionsCount,
          percentage: ((progressMsg.loop + 1) / progressMsg.totalLoops) * 100,
          newReactions: progressMsg.newReactions,
        });
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

  const runCascade = useCallback(
    (params: CascadeParameters, dbBuffer: ArrayBuffer): Promise<CascadeResults> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        if (isRunning) {
          reject(new Error('Cascade simulation already running'));
          return;
        }

        setIsRunning(true);
        setProgress({
          loop: 0,
          totalLoops: params.maxLoops,
          newReactionsCount: 0,
          percentage: 0,
        });
        setError(null);

        resolveRef.current = resolve;
        rejectRef.current = reject;

        const message: CascadeWorkerRequest = {
          type: 'run',
          params,
          dbBuffer,
        };

        workerRef.current.postMessage(message);
      });
    },
    [isRunning]
  );

  const cancelCascade = useCallback(() => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: 'cancel' });
      setIsRunning(false);
      setProgress(null);
      setError('Simulation cancelled');

      if (rejectRef.current) {
        rejectRef.current(new Error('Simulation cancelled by user'));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    }
  }, [isRunning]);

  return {
    runCascade,
    cancelCascade,
    progress,
    isRunning,
    error,
  };
}
