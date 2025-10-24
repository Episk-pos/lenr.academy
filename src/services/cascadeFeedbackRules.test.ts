import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from 'sql.js';
import {
  getElementTemperatureData,
  shouldExcludeByTemperature,
  getBosonFermionData,
  shouldExcludeByBosonFermion,
  isDimerReaction,
  canFormDimer,
  shouldAllowDimerReaction,
  applyFeedbackRules,
} from './cascadeFeedbackRules';
import type { CascadeParameters } from '../types';

describe('Cascade Feedback Rules', () => {
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      exec: vi.fn(),
    } as unknown as Database;
  });

  describe('getElementTemperatureData', () => {
    it('should query element temperature data from database', () => {
      const mockExec = vi.fn().mockReturnValue([
        {
          values: [
            ['H', 14.01, 20.28],  // Hydrogen: melting=14K, boiling=20K
            ['Fe', 1811, 3134],   // Iron: melting=1811K, boiling=3134K
          ],
        },
      ]);
      mockDb.exec = mockExec;

      const result = getElementTemperatureData(mockDb, ['H', 'Fe']);

      expect(result.size).toBe(2);
      expect(result.get('H')).toEqual({
        symbol: 'H',
        melting: 14.01,
        boiling: 20.28,
      });
      expect(result.get('Fe')).toEqual({
        symbol: 'Fe',
        melting: 1811,
        boiling: 3134,
      });
    });
  });

  describe('shouldExcludeByTemperature', () => {
    const hydrogenData = {
      symbol: 'H',
      melting: 14.01,
      boiling: 20.28,
    };

    const ironData = {
      symbol: 'Fe',
      melting: 1811,
      boiling: 3134,
    };

    it('should exclude element if temperature < melting point (excludeMelted=true)', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 1500,  // Below iron melting point
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: true,
        excludeBoiledOff: false,
      };

      const result = shouldExcludeByTemperature('Fe', ironData, params);
      expect(result).toBe(true);
    });

    it('should include element if temperature >= melting point (excludeMelted=true)', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2000,  // Above iron melting point
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: true,
        excludeBoiledOff: false,
      };

      const result = shouldExcludeByTemperature('Fe', ironData, params);
      expect(result).toBe(false);
    });

    it('should exclude element if temperature > boiling point (excludeBoiledOff=true)', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 25,  // Above hydrogen boiling point
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: true,
      };

      const result = shouldExcludeByTemperature('H', hydrogenData, params);
      expect(result).toBe(true);
    });

    it('should include element if temperature <= boiling point (excludeBoiledOff=true)', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 15,  // Below hydrogen boiling point
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: true,
      };

      const result = shouldExcludeByTemperature('H', hydrogenData, params);
      expect(result).toBe(false);
    });

    it('should not exclude if both filters disabled', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 5,  // Below melting and boiling
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

      const result = shouldExcludeByTemperature('H', hydrogenData, params);
      expect(result).toBe(false);
    });
  });

  describe('getBosonFermionData', () => {
    it('should query nuclide boson/fermion classification', () => {
      const mockExec = vi.fn().mockReturnValue([
        {
          values: [
            ['H', 1, 'f', 'b'],    // H-1: nuclear fermion, atomic boson
            ['Li', 7, 'f', 'b'],   // Li-7: nuclear fermion, atomic boson
          ],
        },
      ]);
      mockDb.exec = mockExec;

      const result = getBosonFermionData(mockDb, ['H-1', 'Li-7']);

      expect(result.size).toBe(2);
      expect(result.get('H-1')).toEqual({
        nuclideId: 'H-1',
        nBorF: 'f',
        aBorF: 'b',
      });
      expect(result.get('Li-7')).toEqual({
        nuclideId: 'Li-7',
        nBorF: 'f',
        aBorF: 'b',
      });
    });

    it('should handle empty input', () => {
      const result = getBosonFermionData(mockDb, []);
      expect(result.size).toBe(0);
    });
  });

  describe('shouldExcludeByBosonFermion', () => {
    it('should exclude bosons when feedbackBosons=false', () => {
      const bosonData = { nuclideId: 'He-4', nBorF: 'b' as const, aBorF: 'b' as const };
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: false,  // Exclude bosons
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = shouldExcludeByBosonFermion('He-4', bosonData, params);
      expect(result).toBe(true);
    });

    it('should exclude fermions when feedbackFermions=false', () => {
      const fermionData = { nuclideId: 'H-1', nBorF: 'f' as const, aBorF: 'b' as const };
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: false,  // Exclude fermions
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = shouldExcludeByBosonFermion('H-1', fermionData, params);
      expect(result).toBe(true);
    });

    it('should include when both feedback flags are true', () => {
      const bosonData = { nuclideId: 'He-4', nBorF: 'b' as const, aBorF: 'b' as const };
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

      const result = shouldExcludeByBosonFermion('He-4', bosonData, params);
      expect(result).toBe(false);
    });
  });

  describe('isDimerReaction', () => {
    it('should return true for identical nuclides', () => {
      expect(isDimerReaction('H-1', 'H-1')).toBe(true);
      expect(isDimerReaction('N-14', 'N-14')).toBe(true);
    });

    it('should return false for different nuclides', () => {
      expect(isDimerReaction('H-1', 'Li-7')).toBe(false);
      expect(isDimerReaction('N-14', 'O-16')).toBe(false);
    });
  });

  describe('canFormDimer', () => {
    it('should return true for dimer-forming elements', () => {
      expect(canFormDimer('H-1')).toBe(true);
      expect(canFormDimer('N-14')).toBe(true);
      expect(canFormDimer('O-16')).toBe(true);
      expect(canFormDimer('F-19')).toBe(true);
      expect(canFormDimer('Cl-35')).toBe(true);
      expect(canFormDimer('Br-79')).toBe(true);
      expect(canFormDimer('I-127')).toBe(true);
    });

    it('should return false for non-dimer elements', () => {
      expect(canFormDimer('Li-7')).toBe(false);
      expect(canFormDimer('C-12')).toBe(false);
      expect(canFormDimer('Fe-56')).toBe(false);
    });
  });

  describe('shouldAllowDimerReaction', () => {
    const params: CascadeParameters = {
      fuelNuclides: [],
      temperature: 2400,
      minFusionMeV: 1.0,
      minTwoToTwoMeV: 1.0,
      maxNuclides: 50,
      maxLoops: 2,
      feedbackBosons: true,
      feedbackFermions: true,
      allowDimers: false,  // Dimers disabled
      excludeMelted: false,
      excludeBoiledOff: false,
    };

    it('should block dimer reactions for dimer-forming elements when disabled', () => {
      expect(shouldAllowDimerReaction('H-1', 'H-1', params)).toBe(false);
      expect(shouldAllowDimerReaction('N-14', 'N-14', params)).toBe(false);
    });

    it('should allow dimer reactions for non-dimer elements even when disabled', () => {
      expect(shouldAllowDimerReaction('Li-7', 'Li-7', params)).toBe(true);
      expect(shouldAllowDimerReaction('C-12', 'C-12', params)).toBe(true);
    });

    it('should allow all dimer reactions when enabled', () => {
      const enabledParams = { ...params, allowDimers: true };
      expect(shouldAllowDimerReaction('H-1', 'H-1', enabledParams)).toBe(true);
      expect(shouldAllowDimerReaction('N-14', 'N-14', enabledParams)).toBe(true);
    });

    it('should always allow non-dimer reactions', () => {
      expect(shouldAllowDimerReaction('H-1', 'Li-7', params)).toBe(true);
      expect(shouldAllowDimerReaction('N-14', 'O-16', params)).toBe(true);
    });
  });

  describe('applyFeedbackRules', () => {
    it('should filter by temperature constraints', () => {
      const mockExec = vi.fn().mockReturnValue([
        {
          values: [
            ['H', 14.01, 20.28],   // Low boiling point
            ['Fe', 1811, 3134],    // High melting point
          ],
        },
      ]);
      mockDb.exec = mockExec;

      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 25,  // Room temperature
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: true,   // Exclude not-yet-melted
        excludeBoiledOff: true, // Exclude boiled-off
      };

      const result = applyFeedbackRules(mockDb, ['H-1', 'Fe-56'], params);

      // H boiled off (20.28K < 25K), Fe not melted (1811K > 25K)
      expect(result).toEqual([]);
    });

    it('should filter by boson/fermion classification', () => {
      const mockExec = vi.fn();
      // First call: element temp data (empty since no temp filtering)
      // Second call: boson/fermion data
      mockExec.mockReturnValue([
        {
          values: [
            ['H', 1, 'f', 'b'],
            ['He', 4, 'b', 'b'],
          ],
        },
      ]);
      mockDb.exec = mockExec;

      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: false,  // Exclude bosons
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = applyFeedbackRules(mockDb, ['H-1', 'He-4'], params);

      // He-4 excluded (boson), H-1 included (fermion)
      expect(result).toEqual(['H-1']);
    });

    it('should return all nuclides when no filters active', () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 2400,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 2,
        feedbackBosons: true,   // All enabled
        feedbackFermions: true,
        allowDimers: true,
        excludeMelted: false,
        excludeBoiledOff: false,
      };

      const result = applyFeedbackRules(mockDb, ['H-1', 'Li-7', 'Fe-56'], params);

      // No filtering, all nuclides pass
      expect(result).toEqual(['H-1', 'Li-7', 'Fe-56']);
    });
  });
});
