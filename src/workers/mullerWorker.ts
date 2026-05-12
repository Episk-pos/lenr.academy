/**
 * Muller Resonance Web Worker
 *
 * Runs Muller resonance computations in a background thread to keep the UI responsive.
 * Handles initialization (global pairs, NAE predictions, reaction counts),
 * element selection (finding resonant partners), and element clearing.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import {
  computeTopGlobalPairs,
  queryResonantReactions,
  computeNAEPredictions,
  queryElementReactionCounts,
  findResonantPartners,
} from '../services/mullerResonanceService';
import type {
  MullerResonancePair,
  ReactionOverlap,
  NAEPrediction,
} from '../services/mullerResonanceService';

// ---- Message types ----

export interface MullerInitRequest {
  type: 'init';
  dbBuffer: ArrayBuffer;
  elements: Array<{ Z: number; E: string }>;
}

export interface MullerSelectElementRequest {
  type: 'selectElement';
  selectedZ: number;
  selectedSymbol: string;
  elements: Array<{ Z: number; E: string }>;
  threshold: number;
}

export interface MullerClearElementRequest {
  type: 'clearElement';
}

export type MullerWorkerRequest =
  | MullerInitRequest
  | MullerSelectElementRequest
  | MullerClearElementRequest;

export interface MullerInitCompleteMessage {
  type: 'initComplete';
  globalPairs: MullerResonancePair[];
  globalOverlaps: ReactionOverlap[];
  naePredictions: NAEPrediction[];
  reactionCounts: [number, number][];
}

export interface MullerSelectElementCompleteMessage {
  type: 'selectElementComplete';
  pairs: MullerResonancePair[];
  overlaps: ReactionOverlap[];
}

export interface MullerClearElementCompleteMessage {
  type: 'clearElementComplete';
}

export interface MullerErrorMessage {
  type: 'error';
  error: string;
}

export type MullerWorkerResponse =
  | MullerInitCompleteMessage
  | MullerSelectElementCompleteMessage
  | MullerClearElementCompleteMessage
  | MullerErrorMessage;

// ---- Module-scoped DB instance ----

let db: SqlJsDatabase | null = null;

/**
 * Initialize the database from an ArrayBuffer.
 * Caches the db instance so subsequent messages skip re-initialization.
 */
async function initDatabase(buffer: ArrayBuffer): Promise<void> {
  if (db) return;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  db = new SQL.Database(new Uint8Array(buffer));
}

// ---- Worker message handler ----

self.onmessage = async (event: MessageEvent<MullerWorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init': {
        await initDatabase(message.dbBuffer);
        if (!db) throw new Error('Database not initialized');

        const globalPairs = computeTopGlobalPairs(message.elements, 25);
        const globalOverlaps = queryResonantReactions(db, globalPairs);
        const naePredictions = computeNAEPredictions(message.elements);
        const reactionCountsMap = queryElementReactionCounts(db);
        const reactionCounts: [number, number][] = Array.from(reactionCountsMap.entries());

        const response: MullerInitCompleteMessage = {
          type: 'initComplete',
          globalPairs,
          globalOverlaps,
          naePredictions,
          reactionCounts,
        };
        self.postMessage(response);
        break;
      }

      case 'selectElement': {
        if (!db) throw new Error('Database not initialized');

        const result = findResonantPartners(
          message.selectedZ,
          message.selectedSymbol,
          message.elements,
          message.threshold,
        );
        const overlaps = queryResonantReactions(db, result.pairs);

        const response: MullerSelectElementCompleteMessage = {
          type: 'selectElementComplete',
          pairs: result.pairs,
          overlaps,
        };
        self.postMessage(response);
        break;
      }

      case 'clearElement': {
        const response: MullerClearElementCompleteMessage = {
          type: 'clearElementComplete',
        };
        self.postMessage(response);
        break;
      }
    }
  } catch (error) {
    const response: MullerErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};
