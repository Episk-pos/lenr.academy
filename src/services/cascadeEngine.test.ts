import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFuelNuclides, runCascadeSimulation, calculateReactionWeight } from './cascadeEngine';
import type { Database } from 'sql.js';
import type { CascadeParameters, CascadeParametersV2 } from '../types';
import * as queryService from './queryService';

// Mock the queryService module
vi.mock('./queryService');

describe('cascadeEngine', () => {
  describe('parseFuelNuclides', () => {
    it('should parse standard E-A format', () => {
      const result = parseFuelNuclides(['H-1', 'Li-7', 'C-12']);
      expect(result).toEqual(['H-1', 'Li-7', 'C-12']);
    });

    it('should parse EA format without hyphen', () => {
      const result = parseFuelNuclides(['H1', 'Li7', 'C12']);
      expect(result).toEqual(['H-1', 'Li-7', 'C-12']);
    });

    it('should handle deuterium shorthand', () => {
      const result = parseFuelNuclides(['D']);
      expect(result).toEqual(['D-2']);
    });

    it('should handle tritium shorthand', () => {
      const result = parseFuelNuclides(['T']);
      expect(result).toEqual(['T-3']);
    });

    it('should handle mixed formats', () => {
      const result = parseFuelNuclides(['H-1', 'D', 'T', 'Li7', 'Ni-58']);
      expect(result).toEqual(['H-1', 'D-2', 'T-3', 'Li-7', 'Ni-58']);
    });

    it('should handle whitespace', () => {
      const result = parseFuelNuclides(['  H-1  ', ' Li 7 ', '']);
      expect(result).toEqual(['H-1', 'Li-7']);
    });

    it('should throw on invalid format', () => {
      expect(() => parseFuelNuclides(['InvalidElement']))
        .toThrow(/Invalid nuclide format/);
    });

    it('should throw on missing mass number', () => {
      expect(() => parseFuelNuclides(['H']))
        .toThrow(/Invalid nuclide format/);
    });

    it('should handle two-letter elements', () => {
      const result = parseFuelNuclides(['Al-27', 'Ni58']);
      expect(result).toEqual(['Al-27', 'Ni-58']);
    });
  });

  describe('runCascadeSimulation', () => {
    let mockDb: Database;
    const mockQueryFusion = vi.mocked(queryService.queryFusion);
    const mockQueryTwoToTwo = vi.mocked(queryService.queryTwoToTwo);
    const mockGetAllNuclides = vi.mocked(queryService.getAllNuclides);
    const mockGetAllElements = vi.mocked(queryService.getAllElements);

    beforeEach(() => {
      mockDb = {} as Database;
      vi.clearAllMocks();

      // Default mock responses
      mockGetAllNuclides.mockResolvedValue([
        { id: 1, Z: 1, A: 1, E: 'H', BE: 0, AMU: 1.008, nBorF: 'f', aBorF: 'b' },
        { id: 2, Z: 1, A: 2, E: 'D', BE: 2.224, AMU: 2.014, nBorF: 'b', aBorF: 'f' },
        { id: 3, Z: 3, A: 7, E: 'Li', BE: 39.244, AMU: 7.016, nBorF: 'f', aBorF: 'b' },
        { id: 4, Z: 2, A: 4, E: 'He', BE: 28.296, AMU: 4.003, nBorF: 'b', aBorF: 'b' },
      ]);

      mockGetAllElements.mockResolvedValue([
        { Z: 1, E: 'H', EName: 'Hydrogen', Period: 1, Group: 1 },
        { Z: 2, E: 'He', EName: 'Helium', Period: 1, Group: 18 },
        { Z: 3, E: 'Li', EName: 'Lithium', Period: 2, Group: 1 },
      ]);
    });

    it('should throw on empty fuel nuclides', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      await expect(runCascadeSimulation(mockDb, params))
        .rejects.toThrow(/No valid fuel nuclides/);
    });

    it('should handle no reactions found (single loop)', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.reactions).toHaveLength(0);
      expect(result.loopsExecuted).toBe(0);
      expect(result.terminationReason).toBe('no_new_products');
      expect(result.totalEnergy).toBe(0);
    });

    it('should process fusion reactions in cascade', async () => {
      // Mock fusion: H-1 + Li-7 → He-4 + He-4 (actually 2 products)
      // For simplicity, we'll mock as fusion (which has 1 product)
      mockQueryFusion.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'b',
            aBorF: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0]).toMatchObject({
        type: 'fusion',
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4'],
        MeV: 17.35,
        loop: 0,
      });
      expect(result.totalEnergy).toBe(17.35);
      expect(result.productDistribution.get('He-4')).toBe(1);
    });

    it('should stop at max loops', async () => {
      // Mock reactions that produce different products in each loop
      // to ensure the cascade continues until max loops
      let callCount = 0;
      mockQueryFusion.mockImplementation((async () => {
        callCount++;
        // Loop 0: H + Li → He-4
        // Loop 1: H + He → Li-5
        // Loop 2: He + Li → Be-9
        const reactions = [
          // Always available: H + Li → He-4
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none' as const,
            nBorF1: 'f' as const,
            aBorF1: 'b' as const,
            nBorF2: 'f' as const,
            aBorF2: 'b' as const,
            nBorF: 'b' as const,
            aBorF: 'b' as const,
          },
        ];

        // Add different reactions for each subsequent loop
        if (callCount === 2) {
          reactions.push({
            id: 2,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'He',
            Z2: 2,
            A2: 4,
            E: 'Li',
            Z: 3,
            A: 5,
            MeV: 5.0,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'b',
            aBorF2: 'b',
            nBorF: 'f',
            aBorF: 'b',
          } as any);
        } else if (callCount === 3) {
          reactions.push({
            id: 3,
            E1: 'He',
            Z1: 2,
            A1: 4,
            E2: 'Li',
            Z2: 3,
            A2: 5,
            E: 'Be',
            Z: 4,
            A: 9,
            MeV: 8.0,
            neutrino: 'none',
            nBorF1: 'b',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'f',
            aBorF: 'b',
          } as any);
        }

        return {
          reactions,
          nuclides: [],
          elements: [],
          radioactiveNuclides: new Set(),
          executionTime: 1,
          rowCount: reactions.length,
          totalCount: reactions.length,
        };
      }) as any);

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 3,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.loopsExecuted).toBe(3);
      expect(result.terminationReason).toBe('max_loops');
    });

    it('should process two-to-two reactions', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'D',
            Z1: 1,
            A1: 2,
            E2: 'D',
            Z2: 1,
            A2: 2,
            E3: 'H',
            Z3: 1,
            A3: 1,
            E4: 'H',
            Z4: 1,
            A4: 3, // Tritium
            MeV: 4.03,
            neutrino: 'none',
            nBorF1: 'b',
            aBorF1: 'f',
            nBorF2: 'b',
            aBorF2: 'f',
            nBorF3: 'f',
            aBorF3: 'b',
            nBorF4: 'f',
            aBorF4: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['D-2'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0]).toMatchObject({
        type: 'twotwo',
        inputs: ['D-2', 'D-2'],
        outputs: ['H-1', 'H-3'],
        MeV: 4.03,
        loop: 0,
      });
      expect(result.productDistribution.get('H-1')).toBe(1);
      expect(result.productDistribution.get('H-3')).toBe(1);
    });

    it('should accumulate total energy across reactions', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'b',
            aBorF: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'D',
            Z1: 1,
            A1: 2,
            E2: 'D',
            Z2: 1,
            A2: 2,
            E3: 'H',
            Z3: 1,
            A3: 1,
            E4: 'H',
            Z4: 1,
            A4: 3,
            MeV: 4.03,
            neutrino: 'none',
            nBorF1: 'b',
            aBorF1: 'f',
            nBorF2: 'b',
            aBorF2: 'f',
            nBorF3: 'f',
            aBorF3: 'b',
            nBorF4: 'f',
            aBorF4: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'D-2', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 1,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      // Should have both fusion and two-to-two reactions
      expect(result.reactions.length).toBeGreaterThanOrEqual(1);
      expect(result.totalEnergy).toBeGreaterThan(0);
    });

    it('should track execution time', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 1,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should stop when max nuclides limit reached', async () => {
      // Mock many reactions producing many products
      const manyReactions = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        E1: 'H',
        Z1: 1,
        A1: 1,
        E2: 'Li',
        Z2: 3,
        A2: 7,
        E: 'C', // Different products each time
        Z: 6,
        A: 12 + i, // Different mass numbers
        MeV: 10.0,
        neutrino: 'none' as const,
        nBorF1: 'f' as const,
        aBorF1: 'b' as const,
        nBorF2: 'f' as const,
        aBorF2: 'b' as const,
        nBorF: 'b' as const,
        aBorF: 'b' as const,
      }));

      mockQueryFusion.mockResolvedValue({
        reactions: manyReactions,
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: manyReactions.length,
        totalCount: manyReactions.length,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10, // Low limit
        maxLoops: 10,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      expect(result.terminationReason).toBe('max_nuclides');
    });
  });

  describe('calculateReactionWeight', () => {
    it('should calculate weight for two different nuclides', () => {
      const proportionMap = new Map<string, number>([
        ['H-1', 50],  // 50%
        ['Li-7', 50], // 50%
      ]);

      const weight = calculateReactionWeight(['H-1', 'Li-7'], proportionMap);

      // 0.5 * 0.5 = 0.25
      expect(weight).toBe(0.25);
    });

    it('should calculate weight for same nuclide (A + A reaction)', () => {
      const proportionMap = new Map<string, number>([
        ['D-2', 100], // 100%
      ]);

      const weight = calculateReactionWeight(['D-2', 'D-2'], proportionMap);

      // 1.0 * 1.0 = 1.0
      expect(weight).toBe(1);
    });

    it('should return 0 when one nuclide has 0 proportion', () => {
      const proportionMap = new Map<string, number>([
        ['H-1', 100],
        ['Li-7', 0],
      ]);

      const weight = calculateReactionWeight(['H-1', 'Li-7'], proportionMap);

      expect(weight).toBe(0);
    });

    it('should return 0 when nuclide is not in proportion map', () => {
      const proportionMap = new Map<string, number>([
        ['H-1', 100],
      ]);

      const weight = calculateReactionWeight(['H-1', 'Li-7'], proportionMap);

      expect(weight).toBe(0);
    });

    it('should handle asymmetric proportions', () => {
      const proportionMap = new Map<string, number>([
        ['H-1', 90],  // 90%
        ['Li-7', 10], // 10%
      ]);

      const weight = calculateReactionWeight(['H-1', 'Li-7'], proportionMap);

      // 0.9 * 0.1 = 0.09
      expect(weight).toBeCloseTo(0.09, 5);
    });
  });

  describe('weighted mode simulation', () => {
    let mockDb: Database;
    const mockQueryFusion = vi.mocked(queryService.queryFusion);
    const mockQueryTwoToTwo = vi.mocked(queryService.queryTwoToTwo);
    const mockGetAllNuclides = vi.mocked(queryService.getAllNuclides);
    const mockGetAllElements = vi.mocked(queryService.getAllElements);

    beforeEach(() => {
      mockDb = {} as Database;
      vi.clearAllMocks();

      mockGetAllNuclides.mockResolvedValue([
        { id: 1, Z: 1, A: 1, E: 'H', BE: 0, AMU: 1.008, nBorF: 'f', aBorF: 'b' },
        { id: 2, Z: 3, A: 7, E: 'Li', BE: 39.244, AMU: 7.016, nBorF: 'f', aBorF: 'b' },
        { id: 3, Z: 2, A: 4, E: 'He', BE: 28.296, AMU: 4.003, nBorF: 'b', aBorF: 'b' },
      ]);

      mockGetAllElements.mockResolvedValue([
        { Z: 1, E: 'H', EName: 'Hydrogen', Period: 1, Group: 1 },
        { Z: 2, E: 'He', EName: 'Helium', Period: 1, Group: 18 },
        { Z: 3, E: 'Li', EName: 'Lithium', Period: 2, Group: 1 },
      ]);
    });

    it('should apply weights to reactions in weighted mode', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'b',
            aBorF: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParametersV2 = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
        weightedFuel: [
          { nuclideId: 'H-1', proportion: 90 },  // 90% hydrogen
          { nuclideId: 'Li-7', proportion: 10 }, // 10% lithium
        ],
      };

      const result = await runCascadeSimulation(mockDb, params);

      // Should have weighted mode enabled in results
      expect(result.useWeightedMode).toBe(true);
      expect(result.weightedFuel).toBeDefined();

      // Reaction should have weight calculated
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].weight).toBeDefined();
      // Weight should be 0.9 * 0.1 = 0.09
      expect(result.reactions[0].weight).toBeCloseTo(0.09, 5);

      // Weighted energy should be MeV * weight
      expect(result.weightedEnergy).toBeDefined();
      expect(result.weightedEnergy).toBeCloseTo(17.35 * 0.09, 4);
    });

    it('should produce different weights for different fuel proportions (regression test)', async () => {
      // This is a key regression test:
      // Same reactions, different fuel proportions should produce different weighted results

      mockQueryFusion.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'b',
            aBorF: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const baseParams = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      // Run with 90:10 ratio
      const params90_10: CascadeParametersV2 = {
        ...baseParams,
        weightedFuel: [
          { nuclideId: 'H-1', proportion: 90 },
          { nuclideId: 'Li-7', proportion: 10 },
        ],
      };
      const result90_10 = await runCascadeSimulation(mockDb, params90_10);

      // Run with 50:50 ratio
      const params50_50: CascadeParametersV2 = {
        ...baseParams,
        weightedFuel: [
          { nuclideId: 'H-1', proportion: 50 },
          { nuclideId: 'Li-7', proportion: 50 },
        ],
      };
      const result50_50 = await runCascadeSimulation(mockDb, params50_50);

      // Run with 10:90 ratio
      const params10_90: CascadeParametersV2 = {
        ...baseParams,
        weightedFuel: [
          { nuclideId: 'H-1', proportion: 10 },
          { nuclideId: 'Li-7', proportion: 90 },
        ],
      };
      const result10_90 = await runCascadeSimulation(mockDb, params10_90);

      // KEY ASSERTION: Different proportions should produce different weighted energies
      // 50:50 should have highest weighted energy (0.5 * 0.5 = 0.25)
      // 90:10 and 10:90 should have same weighted energy (0.9 * 0.1 = 0.09)
      expect(result50_50.weightedEnergy).toBeGreaterThan(result90_10.weightedEnergy!);
      expect(result90_10.weightedEnergy).toBeCloseTo(result10_90.weightedEnergy!, 5);

      // Verify exact values
      expect(result90_10.reactions[0].weight).toBeCloseTo(0.09, 5);
      expect(result50_50.reactions[0].weight).toBeCloseTo(0.25, 5);
      expect(result10_90.reactions[0].weight).toBeCloseTo(0.09, 5);
    });

    it('should not include weight field when weighted mode is disabled', async () => {
      mockQueryFusion.mockResolvedValue({
        reactions: [
          {
            id: 1,
            E1: 'H',
            Z1: 1,
            A1: 1,
            E2: 'Li',
            Z2: 3,
            A2: 7,
            E: 'He',
            Z: 2,
            A: 4,
            MeV: 17.35,
            neutrino: 'none',
            nBorF1: 'f',
            aBorF1: 'b',
            nBorF2: 'f',
            aBorF2: 'b',
            nBorF: 'b',
            aBorF: 'b',
          },
        ],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 1,
        rowCount: 1,
        totalCount: 1,
      });

      mockQueryTwoToTwo.mockResolvedValue({
        reactions: [],
        nuclides: [],
        elements: [],
        radioactiveNuclides: new Set(),
        executionTime: 0,
        rowCount: 0,
        totalCount: 0,
      });

      const params: CascadeParameters = {
        fuelNuclides: ['H-1', 'Li-7'],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = await runCascadeSimulation(mockDb, params);

      // Should NOT have weighted mode fields
      expect(result.useWeightedMode).toBeUndefined();
      expect(result.weightedEnergy).toBeUndefined();
      expect(result.reactions[0].weight).toBeUndefined();

      // Product distribution should be count-based (1 for each occurrence)
      expect(result.productDistribution.get('He-4')).toBe(1);
    });
  });
});
