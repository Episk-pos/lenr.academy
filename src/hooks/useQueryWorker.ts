import { useState, useRef, useCallback, useEffect } from 'react';
import type { QueryFilter, QueryResult, FusionReaction, FissionReaction, TwoToTwoReaction } from '../types';
import type { QueryWorkerRequest, QueryWorkerResponse } from '../workers/queryWorker';

export interface UseQueryWorkerReturn {
  runQuery: <T extends FusionReaction | FissionReaction | TwoToTwoReaction>(
    queryType: 'fusion' | 'fission' | 'twotwo',
    filter: QueryFilter,
    dbBuffer: ArrayBuffer
  ) => Promise<QueryResult<T>>;
  isRunning: boolean;
  error: string | null;
}

/**
 * Hook to run SQL queries in a Web Worker for non-blocking UI.
 *
 * Usage follows the same pattern as useCascadeWorker:
 * 1. Get dbBuffer from db.export().buffer
 * 2. Call runQuery with type, filter, and buffer
 * 3. Returns a QueryResult matching the main-thread queryService API
 */
export function useQueryWorker(): UseQueryWorkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((result: any) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/queryWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<QueryWorkerResponse>) => {
      const message = event.data;

      if (message.type === 'complete') {
        setIsRunning(false);
        setError(null);

        if (resolveRef.current) {
          // Convert serialized radioactiveNuclides array back to Set
          const result: QueryResult<any> = {
            ...message.result,
            radioactiveNuclides: new Set(message.result.radioactiveNuclides),
          };
          resolveRef.current(result);
          resolveRef.current = null;
          rejectRef.current = null;
        }
      } else if (message.type === 'error') {
        setIsRunning(false);
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
      const errorMsg = event.message || 'Query worker error';
      setError(errorMsg);

      if (rejectRef.current) {
        rejectRef.current(new Error(errorMsg));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    };

    workerRef.current = worker;

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;

      // Reject any pending promise so callers don't hang forever
      if (rejectRef.current) {
        rejectRef.current(new Error('Worker terminated on unmount'));
        resolveRef.current = null;
        rejectRef.current = null;
      }
    };
  }, []);

  const runQuery = useCallback(
    <T extends FusionReaction | FissionReaction | TwoToTwoReaction>(
      queryType: 'fusion' | 'fission' | 'twotwo',
      filter: QueryFilter,
      dbBuffer: ArrayBuffer
    ): Promise<QueryResult<T>> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        if (isRunning) {
          reject(new Error('Query already running'));
          return;
        }

        setIsRunning(true);
        setError(null);

        resolveRef.current = resolve;
        rejectRef.current = reject;

        const message: QueryWorkerRequest = {
          type: 'query',
          queryType,
          filter,
          dbBuffer,
        };

        workerRef.current.postMessage(message, [message.dbBuffer]);
      });
    },
    [isRunning]
  );

  return { runQuery, isRunning, error };
}
