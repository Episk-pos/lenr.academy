/**
 * Cycle Discovery Web Worker
 *
 * Runs cycle discovery in a background thread to keep the UI responsive.
 * Sends progress updates during execution and supports cancellation.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { CycleDiscoveryParameters, CycleDiscoveryResults, CycleDiscoveryProgress } from '../types';
import { discoverCycles } from '../services/cycleDiscoveryService';

// Message types
export interface CycleDiscoveryRunRequest {
  type: 'run';
  params: CycleDiscoveryParameters;
  dbBuffer: ArrayBuffer;
}

export interface CycleDiscoveryCancelRequest {
  type: 'cancel';
}

export type CycleDiscoveryWorkerRequest =
  | CycleDiscoveryRunRequest
  | CycleDiscoveryCancelRequest;

export interface CycleDiscoveryProgressMessage {
  type: 'progress';
  progress: CycleDiscoveryProgress;
}

export interface CycleDiscoveryCompleteMessage {
  type: 'complete';
  results: CycleDiscoveryResults;
}

export interface CycleDiscoveryErrorMessage {
  type: 'error';
  error: string;
}

export type CycleDiscoveryWorkerResponse =
  | CycleDiscoveryProgressMessage
  | CycleDiscoveryCompleteMessage
  | CycleDiscoveryErrorMessage;

let db: SqlJsDatabase | null = null;
let shouldCancel = false;

/**
 * Initialize the database from an ArrayBuffer
 */
async function initDatabase(buffer: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  const uint8Array = new Uint8Array(buffer);
  db = new SQL.Database(uint8Array);
}

/**
 * Run cycle discovery with progress updates
 */
async function runDiscoveryWithProgress(params: CycleDiscoveryParameters): Promise<CycleDiscoveryResults> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const onProgress = (progress: CycleDiscoveryProgress): void => {
    postMessage({
      type: 'progress',
      progress,
    } as CycleDiscoveryProgressMessage);
  };

  const results = discoverCycles(db, params, onProgress, () => shouldCancel);

  return results;
}

/**
 * Message handler
 */
self.onmessage = async (event: MessageEvent<CycleDiscoveryWorkerRequest>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    shouldCancel = true;
    return;
  }

  if (message.type === 'run') {
    try {
      shouldCancel = false;

      // Always (re-)initialize the database from the provided buffer
      // so reruns after a DB update don't use a stale copy
      await initDatabase(message.dbBuffer);

      // Run cycle discovery with progress updates
      const results = await runDiscoveryWithProgress(message.params);

      postMessage({
        type: 'complete',
        results,
      } as CycleDiscoveryCompleteMessage);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      postMessage({
        type: 'error',
        error: errorMessage,
      } as CycleDiscoveryErrorMessage);
    } finally {
      shouldCancel = false;
    }
  }
};
