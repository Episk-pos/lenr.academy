/**
 * Unit tests for useCascadeWorker hook
 *
 * Tests:
 * - Worker initialization and cleanup
 * - Successful cascade execution
 * - Progress tracking and updates
 * - Cancellation behavior
 * - Error handling (worker errors, message errors)
 * - Edge cases (already running, worker not initialized)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCascadeWorker } from './useCascadeWorker';
import type { CascadeParameters, CascadeResults } from '../types';
import type { CascadeWorkerResponse } from '../workers/cascadeWorker';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  // Helper to simulate worker messages
  simulateMessage(data: CascadeWorkerResponse) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Helper to simulate worker errors
  simulateError(message: string) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { message }));
    }
  }
}

let mockWorkerInstance: MockWorker;

// Mock the Worker constructor
vi.stubGlobal('Worker', vi.fn(function(this: any, url: URL | string, options?: WorkerOptions) {
  mockWorkerInstance = new MockWorker();
  return mockWorkerInstance;
}));

// Mock URL.createObjectURL (required by Vite's worker import)
vi.stubGlobal('URL', class MockURL extends URL {
  constructor(url: string, base?: string | URL) {
    super(url, base || 'http://localhost');
  }
});

describe('useCascadeWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure worker is cleaned up after each test
    if (mockWorkerInstance) {
      mockWorkerInstance.terminate();
    }
  });

  describe('initialization and cleanup', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCascadeWorker());

      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.runCascade).toBe('function');
      expect(typeof result.current.cancelCascade).toBe('function');
    });

    it('should create a worker on mount', () => {
      renderHook(() => useCascadeWorker());

      expect(Worker).toHaveBeenCalledTimes(1);
    });

    it('should terminate worker on unmount', () => {
      const { unmount } = renderHook(() => useCascadeWorker());

      expect(mockWorkerInstance.terminate).not.toHaveBeenCalled();

      unmount();

      expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
    });
  });

  describe('runCascade', () => {
    it('should start a cascade simulation successfully', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      const mockDbBuffer = new ArrayBuffer(8);

      // Start cascade
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, mockDbBuffer);
      });

      // Verify running state
      expect(result.current.isRunning).toBe(true);
      expect(result.current.error).toBe(null);

      // Verify worker received message
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        type: 'run',
        params: mockParams,
        dbBuffer: mockDbBuffer,
      });

      // Verify initial progress
      expect(result.current.progress).toEqual({
        loop: 0,
        totalLoops: 10,
        newReactionsCount: 0,
        percentage: 0,
      });

      // Simulate completion
      const mockResults: CascadeResults = {
        reactions: [],
        productDistribution: new Map(),
        nuclides: [],
        elements: [],
        totalEnergy: 100.5,
        loopsExecuted: 5,
        executionTime: 1234.56,
        terminationReason: 'no_new_products',
      };

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'complete',
          results: mockResults,
        });
      });

      // Verify results
      const results = await cascadePromise!;
      expect(results).toEqual(mockResults);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should handle worker initialization', () => {
      const { result } = renderHook(() => useCascadeWorker());

      // Verify worker is created
      expect(Worker).toHaveBeenCalled();
      expect(result.current.runCascade).toBeDefined();
      expect(result.current.cancelCascade).toBeDefined();

      // Note: The worker is always initialized on mount, so there's no realistic
      // way for workerRef.current to be null while the hook is still mounted.
      // The null check in the code is defensive programming.
    });

    it('should reject if cascade is already running', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start first cascade
      act(() => {
        result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      expect(result.current.isRunning).toBe(true);

      // Try to start second cascade
      await expect(result.current.runCascade(mockParams, new ArrayBuffer(8)))
        .rejects.toThrow('Cascade simulation already running');
    });
  });

  describe('progress tracking', () => {
    it('should update progress during cascade execution', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      act(() => {
        result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate progress update
      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'progress',
          loop: 3,
          totalLoops: 10,
          newReactionsCount: 15,
        });
      });

      // Verify progress
      expect(result.current.progress).toEqual({
        loop: 3,
        totalLoops: 10,
        newReactionsCount: 15,
        percentage: 40, // (3 + 1) / 10 * 100
      });
    });

    it('should include incremental reactions in progress updates', () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      act(() => {
        result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate progress with incremental reactions
      const mockReactions = [
        { type: 'fusion', inputs: ['H-1', 'Li-7'], outputs: ['He-4'], MeV: 17.3 },
      ];

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'progress',
          loop: 2,
          totalLoops: 10,
          newReactionsCount: 1,
          newReactions: mockReactions,
        });
      });

      // Verify progress includes reactions
      expect(result.current.progress?.newReactions).toEqual(mockReactions);
    });

    it('should handle multiple progress updates', () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      act(() => {
        result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate multiple progress updates
      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'progress',
          loop: 0,
          totalLoops: 10,
          newReactionsCount: 5,
        });
      });

      expect(result.current.progress?.percentage).toBe(10);

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'progress',
          loop: 4,
          totalLoops: 10,
          newReactionsCount: 12,
        });
      });

      expect(result.current.progress?.percentage).toBe(50);

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'progress',
          loop: 9,
          totalLoops: 10,
          newReactionsCount: 3,
        });
      });

      expect(result.current.progress?.percentage).toBe(100);
    });
  });

  describe('cancellation', () => {
    it('should cancel a running cascade', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      expect(result.current.isRunning).toBe(true);

      // Cancel
      act(() => {
        result.current.cancelCascade();
      });

      // Verify state
      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe('Simulation cancelled');

      // Verify worker received cancel message
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({ type: 'cancel' });

      // Verify promise is rejected
      await expect(cascadePromise!).rejects.toThrow('Simulation cancelled by user');
    });

    it('should do nothing if not running', () => {
      const { result } = renderHook(() => useCascadeWorker());

      expect(result.current.isRunning).toBe(false);

      // Try to cancel when not running
      act(() => {
        result.current.cancelCascade();
      });

      // Verify no message sent
      expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
      expect(result.current.error).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle worker message errors', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate error message
      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'error',
          error: 'Database not initialized',
        });
      });

      // Verify state
      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe('Database not initialized');

      // Verify promise is rejected
      await expect(cascadePromise!).rejects.toThrow('Database not initialized');
    });

    it('should handle worker onerror events', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate worker error
      act(() => {
        mockWorkerInstance.simulateError('Worker script failed to load');
      });

      // Verify state
      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe('Worker script failed to load');

      // Verify promise is rejected
      await expect(cascadePromise!).rejects.toThrow('Worker script failed to load');
    });

    it('should handle worker error with no message', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Start cascade
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      // Simulate worker error with no message
      act(() => {
        mockWorkerInstance.simulateError('');
      });

      // Verify default error message
      expect(result.current.error).toBe('Worker error occurred');

      // Verify promise is rejected
      await expect(cascadePromise!).rejects.toThrow('Worker error occurred');
    });
  });

  describe('state transitions', () => {
    it('should transition from idle → running → complete', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      // Initial state
      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe(null);

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Transition to running
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.progress).not.toBe(null);
      expect(result.current.error).toBe(null);

      // Transition to complete
      const mockResults: CascadeResults = {
        reactions: [],
        productDistribution: new Map(),
        nuclides: [],
        elements: [],
        totalEnergy: 50,
        loopsExecuted: 3,
        executionTime: 500,
        terminationReason: 'no_new_products',
      };

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'complete',
          results: mockResults,
        });
      });

      await cascadePromise!;

      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should transition from running → error', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // Transition to running
      let cascadePromise: Promise<CascadeResults>;
      act(() => {
        cascadePromise = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      expect(result.current.isRunning).toBe(true);

      // Transition to error
      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'error',
          error: 'Invalid parameters',
        });
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.error).toBe('Invalid parameters');

      await expect(cascadePromise!).rejects.toThrow('Invalid parameters');
    });

    it('should allow new cascade after completion', async () => {
      const { result } = renderHook(() => useCascadeWorker());

      const mockParams: CascadeParameters = {
        fuelNuclides: ['H-1'],
        maxLoops: 10,
        maxNuclides: 100,
        minFusionMeV: 0,
        minTwoToTwoMeV: 0,
        temperature: 300,
        excludeMelted: false,
        excludeBoiledOff: false,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
      };

      // First cascade
      let cascade1: Promise<CascadeResults>;
      act(() => {
        cascade1 = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'complete',
          results: {
            reactions: [],
            productDistribution: new Map(),
            nuclides: [],
            elements: [],
            totalEnergy: 100,
            loopsExecuted: 5,
            executionTime: 1000,
            terminationReason: 'no_new_products',
          },
        });
      });

      await cascade1!;

      expect(result.current.isRunning).toBe(false);

      // Second cascade should work
      let cascade2: Promise<CascadeResults>;
      act(() => {
        cascade2 = result.current.runCascade(mockParams, new ArrayBuffer(8));
      });

      expect(result.current.isRunning).toBe(true);

      act(() => {
        mockWorkerInstance.simulateMessage({
          type: 'complete',
          results: {
            reactions: [],
            productDistribution: new Map(),
            nuclides: [],
            elements: [],
            totalEnergy: 200,
            loopsExecuted: 8,
            executionTime: 1500,
            terminationReason: 'max_loops',
          },
        });
      });

      const results2 = await cascade2!;
      expect(results2.totalEnergy).toBe(200);
    });
  });
});
