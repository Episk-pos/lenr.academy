import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFuelNuclides, runCascadeSimulation } from './cascadeEngine';
import type { Database } from 'sql.js';
import type { CascadeParameters } from '../types';
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
      mockQueryFusion.mockImplementation((async (_db: any, _filter: any) => {
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
});
