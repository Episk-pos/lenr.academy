import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNuclidesForElement,
  filterAbundantNuclides,
  filterStableNuclides,
  getMostAbundantNuclide,
  formatAbundance,
  getAbundanceTierColor,
  getAbundanceTierHoverColor,
  parseNuclideNotation,
  formatNuclideNotation,
  type NuclideWithAbundance,
} from './isotopeService';
import type { Database } from 'sql.js';

// Mock Database
const createMockDatabase = () => ({
  exec: vi.fn(),
} as unknown as Database);

describe('isotopeService', () => {
  describe('getNuclidesForElement', () => {
    let mockDb: Database;

    beforeEach(() => {
      mockDb = createMockDatabase();
    });

    it('should return empty array for non-existent element', () => {
      vi.mocked(mockDb.exec).mockReturnValue([]);

      const result = getNuclidesForElement(mockDb, 'Xx');

      expect(result).toEqual([]);
      expect(mockDb.exec).toHaveBeenCalledWith(
        'SELECT * FROM NuclidesPlus WHERE E = ? ORDER BY A',
        ['Xx']
      );
    });

    it('should return nuclides sorted by abundance (descending)', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['Li', 6, 3, 7.5, 10],    // Abundance: 7.5%
            ['Li', 7, 3, 92.5, 10],   // Abundance: 92.5%
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'Li');

      expect(result).toHaveLength(2);
      expect(result[0].notation).toBe('Li-7');  // Most abundant first
      expect(result[0].abundance).toBe(92.5);
      expect(result[1].notation).toBe('Li-6');
      expect(result[1].abundance).toBe(7.5);
    });

    it('should sort nuclides without abundance by mass number', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['Tc', 99, 43, null, 8],     // No abundance
            ['Tc', 97, 43, null, 8],     // No abundance
            ['Tc', 98, 43, null, 7],     // No abundance
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'Tc');

      expect(result).toHaveLength(3);
      // No abundance, so sorted by mass number
      expect(result[0].notation).toBe('Tc-97');
      expect(result[1].notation).toBe('Tc-98');
      expect(result[2].notation).toBe('Tc-99');
    });

    it('should correctly classify abundance tiers', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['Ni', 58, 28, 68.077, 10],   // Abundant: ≥10%
            ['Ni', 60, 28, 26.223, 10],   // Abundant: ≥10%
            ['Ni', 61, 28, 1.140, 10],    // Trace: 0.1-10%
            ['Ni', 62, 28, 3.634, 10],    // Trace: 0.1-10%
            ['Ni', 64, 28, 0.926, 10],    // Trace: 0.1-10%
            ['Ni', 63, 28, 0.003, 10],    // Rare: <0.1%
            ['Ni', 59, 28, null, 8],      // Synthetic: no abundance
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'Ni');

      const ni58 = result.find((n) => n.A === 58);
      const ni61 = result.find((n) => n.A === 61);
      const ni63 = result.find((n) => n.A === 63);
      const ni59 = result.find((n) => n.A === 59);

      expect(ni58?.abundanceTier).toBe('abundant');
      expect(ni61?.abundanceTier).toBe('trace');
      expect(ni63?.abundanceTier).toBe('rare');
      expect(ni59?.abundanceTier).toBe('synthetic');
    });

    it('should correctly identify stable nuclides (LHL > 9)', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['C', 12, 6, 98.9, 15],    // LHL=15 > 9 → stable
            ['C', 13, 6, 1.1, 15],     // LHL=15 > 9 → stable
            ['C', 14, 6, null, 3.8],   // LHL=3.8 < 9 → radioactive
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'C');

      const c12 = result.find((n) => n.A === 12);
      const c13 = result.find((n) => n.A === 13);
      const c14 = result.find((n) => n.A === 14);

      expect(c12?.isStable).toBe(true);
      expect(c13?.isStable).toBe(true);
      expect(c14?.isStable).toBe(false);
    });

    it('should create correct notation format', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [['U', 235, 92, 0.72, 9]],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'U');

      expect(result[0].notation).toBe('U-235');
    });

    it('should map database column names correctly', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'P', 'G', 'LHL', 'pcaNCrust'],
          values: [['H', 1, 1, 1, 1, 15, 99.98]],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'H');

      expect(result[0]).toMatchObject({
        E: 'H',
        A: 1,
        Z: 1,
        Period: 1,           // 'P' → Period
        Group: 1,            // 'G' → Group
        logHalfLife: 15,     // 'LHL' → logHalfLife
      });
    });
  });

  describe('filterAbundantNuclides', () => {
    const mockNuclides: NuclideWithAbundance[] = [
      {
        E: 'Ni', A: 58, Z: 28, abundance: 68.077,
        abundanceTier: 'abundant', isStable: true, notation: 'Ni-58',
      } as NuclideWithAbundance,
      {
        E: 'Ni', A: 61, Z: 28, abundance: 1.140,
        abundanceTier: 'trace', isStable: true, notation: 'Ni-61',
      } as NuclideWithAbundance,
      {
        E: 'Ni', A: 63, Z: 28, abundance: 0.003,
        abundanceTier: 'rare', isStable: true, notation: 'Ni-63',
      } as NuclideWithAbundance,
      {
        E: 'Ni', A: 59, Z: 28, abundance: undefined,
        abundanceTier: 'synthetic', isStable: false, notation: 'Ni-59',
      } as NuclideWithAbundance,
    ];

    it('should filter nuclides above default threshold (1%)', () => {
      const result = filterAbundantNuclides(mockNuclides);

      expect(result).toHaveLength(2);
      expect(result[0].A).toBe(58);  // 68.077%
      expect(result[1].A).toBe(61);  // 1.140%
    });

    it('should filter nuclides above custom threshold', () => {
      const result = filterAbundantNuclides(mockNuclides, 10);

      expect(result).toHaveLength(1);
      expect(result[0].A).toBe(58);  // Only 68.077% > 10%
    });

    it('should exclude nuclides with no abundance data', () => {
      const result = filterAbundantNuclides(mockNuclides, 0.001);

      expect(result).toHaveLength(3);
      expect(result.every((n) => n.A !== 59)).toBe(true);  // Ni-59 has no abundance
    });

    it('should return empty array if no nuclides meet threshold', () => {
      const result = filterAbundantNuclides(mockNuclides, 100);

      expect(result).toEqual([]);
    });
  });

  describe('filterStableNuclides', () => {
    const mockNuclides: NuclideWithAbundance[] = [
      {
        E: 'C', A: 12, Z: 6, abundance: 98.9,
        abundanceTier: 'abundant', isStable: true, notation: 'C-12',
      } as NuclideWithAbundance,
      {
        E: 'C', A: 13, Z: 6, abundance: 1.1,
        abundanceTier: 'trace', isStable: true, notation: 'C-13',
      } as NuclideWithAbundance,
      {
        E: 'C', A: 14, Z: 6, abundance: undefined,
        abundanceTier: 'synthetic', isStable: false, notation: 'C-14',
      } as NuclideWithAbundance,
    ];

    it('should filter only stable nuclides', () => {
      const result = filterStableNuclides(mockNuclides);

      expect(result).toHaveLength(2);
      expect(result.every((n) => n.isStable)).toBe(true);
      expect(result[0].A).toBe(12);
      expect(result[1].A).toBe(13);
    });

    it('should return empty array if no stable nuclides', () => {
      const radioactiveOnly: NuclideWithAbundance[] = [
        {
          E: 'Tc', A: 99, Z: 43, abundance: undefined,
          abundanceTier: 'synthetic', isStable: false, notation: 'Tc-99',
        } as NuclideWithAbundance,
      ];

      const result = filterStableNuclides(radioactiveOnly);

      expect(result).toEqual([]);
    });
  });

  describe('getMostAbundantNuclide', () => {
    it('should return the most abundant nuclide', () => {
      const nuclides: NuclideWithAbundance[] = [
        {
          E: 'Li', A: 7, Z: 3, abundance: 92.5,
          abundanceTier: 'abundant', isStable: true, notation: 'Li-7',
        } as NuclideWithAbundance,
        {
          E: 'Li', A: 6, Z: 3, abundance: 7.5,
          abundanceTier: 'trace', isStable: true, notation: 'Li-6',
        } as NuclideWithAbundance,
      ];

      const result = getMostAbundantNuclide(nuclides);

      expect(result?.A).toBe(7);
      expect(result?.abundance).toBe(92.5);
    });

    it('should return first nuclide if all are synthetic', () => {
      const nuclides: NuclideWithAbundance[] = [
        {
          E: 'Tc', A: 97, Z: 43, abundance: undefined,
          abundanceTier: 'synthetic', isStable: false, notation: 'Tc-97',
        } as NuclideWithAbundance,
        {
          E: 'Tc', A: 99, Z: 43, abundance: undefined,
          abundanceTier: 'synthetic', isStable: false, notation: 'Tc-99',
        } as NuclideWithAbundance,
      ];

      const result = getMostAbundantNuclide(nuclides);

      expect(result?.A).toBe(97);  // First nuclide
    });

    it('should return null for empty array', () => {
      const result = getMostAbundantNuclide([]);

      expect(result).toBeNull();
    });

    it('should skip nuclides with zero abundance', () => {
      const nuclides: NuclideWithAbundance[] = [
        {
          E: 'X', A: 1, Z: 1, abundance: 0,
          abundanceTier: 'rare', isStable: true, notation: 'X-1',
        } as NuclideWithAbundance,
        {
          E: 'X', A: 2, Z: 1, abundance: 100,
          abundanceTier: 'abundant', isStable: true, notation: 'X-2',
        } as NuclideWithAbundance,
      ];

      const result = getMostAbundantNuclide(nuclides);

      expect(result?.A).toBe(2);  // Skips zero abundance
    });
  });

  describe('formatAbundance', () => {
    it('should format abundance ≥10% with 1 decimal place', () => {
      expect(formatAbundance(68.077)).toBe('68.1%');
      expect(formatAbundance(15.3)).toBe('15.3%');
      expect(formatAbundance(10.0)).toBe('10.0%');
    });

    it('should format abundance 0.1-10% with 2 decimal places', () => {
      expect(formatAbundance(1.140)).toBe('1.14%');
      expect(formatAbundance(5.42)).toBe('5.42%');
      expect(formatAbundance(0.1)).toBe('0.10%');
    });

    it('should format abundance <0.1% with 3 decimal places', () => {
      expect(formatAbundance(0.072)).toBe('0.072%');
      expect(formatAbundance(0.012)).toBe('0.012%');
      expect(formatAbundance(0.001)).toBe('0.001%');
    });

    it('should format very small and zero abundances', () => {
      expect(formatAbundance(0)).toBe('<0.001%');     // Exactly zero → else branch
      expect(formatAbundance(0.0001)).toBe('0.000%'); // Very small but > 0
      expect(formatAbundance(0.0009)).toBe('0.001%'); // Just below 0.001%
    });

    it('should show "Synthetic" for undefined/null abundance', () => {
      expect(formatAbundance(undefined)).toBe('Synthetic');
      expect(formatAbundance(null as any)).toBe('Synthetic');
    });
  });

  describe('getAbundanceTierColor', () => {
    it('should return green classes for abundant', () => {
      const result = getAbundanceTierColor('abundant');

      expect(result).toContain('bg-green-100');
      expect(result).toContain('border-green-500');
      expect(result).toContain('text-green-900');
    });

    it('should return yellow classes for trace', () => {
      const result = getAbundanceTierColor('trace');

      expect(result).toContain('bg-yellow-100');
      expect(result).toContain('border-yellow-500');
      expect(result).toContain('text-yellow-900');
    });

    it('should return gray classes for rare', () => {
      const result = getAbundanceTierColor('rare');

      expect(result).toContain('bg-gray-100');
      expect(result).toContain('border-gray-400');
      expect(result).toContain('text-gray-700');
    });

    it('should return gray classes for synthetic', () => {
      const result = getAbundanceTierColor('synthetic');

      expect(result).toContain('bg-gray-100');
      expect(result).toContain('border-gray-400');
      expect(result).toContain('text-gray-700');
    });
  });

  describe('getAbundanceTierHoverColor', () => {
    it('should return green hover class for abundant', () => {
      const result = getAbundanceTierHoverColor('abundant');

      expect(result).toContain('hover:bg-green-200');
    });

    it('should return yellow hover class for trace', () => {
      const result = getAbundanceTierHoverColor('trace');

      expect(result).toContain('hover:bg-yellow-200');
    });

    it('should return gray hover class for rare', () => {
      const result = getAbundanceTierHoverColor('rare');

      expect(result).toContain('hover:bg-gray-200');
    });

    it('should return gray hover class for synthetic', () => {
      const result = getAbundanceTierHoverColor('synthetic');

      expect(result).toContain('hover:bg-gray-200');
    });
  });

  describe('parseNuclideNotation', () => {
    it('should parse standard hyphenated format (E-A)', () => {
      expect(parseNuclideNotation('Li-7')).toEqual({ element: 'Li', massNumber: 7 });
      expect(parseNuclideNotation('U-235')).toEqual({ element: 'U', massNumber: 235 });
      expect(parseNuclideNotation('Fe-56')).toEqual({ element: 'Fe', massNumber: 56 });
    });

    it('should parse format without hyphen (EA)', () => {
      expect(parseNuclideNotation('Li7')).toEqual({ element: 'Li', massNumber: 7 });
      expect(parseNuclideNotation('U235')).toEqual({ element: 'U', massNumber: 235 });
      expect(parseNuclideNotation('Fe56')).toEqual({ element: 'Fe', massNumber: 56 });
    });

    it('should parse format with space (E A)', () => {
      expect(parseNuclideNotation('Li 7')).toEqual({ element: 'Li', massNumber: 7 });
      expect(parseNuclideNotation('U 235')).toEqual({ element: 'U', massNumber: 235 });
    });

    it('should handle deuterium shorthand', () => {
      expect(parseNuclideNotation('D')).toEqual({ element: 'D', massNumber: 2 });
    });

    it('should handle tritium shorthand', () => {
      expect(parseNuclideNotation('T')).toEqual({ element: 'T', massNumber: 3 });
    });

    it('should handle whitespace', () => {
      expect(parseNuclideNotation('  Li-7  ')).toEqual({ element: 'Li', massNumber: 7 });
      expect(parseNuclideNotation(' D ')).toEqual({ element: 'D', massNumber: 2 });
    });

    it('should return null for invalid formats', () => {
      expect(parseNuclideNotation('InvalidElement')).toBeNull();
      expect(parseNuclideNotation('H')).toBeNull();  // Missing mass number
      expect(parseNuclideNotation('123')).toBeNull();  // No element
      expect(parseNuclideNotation('')).toBeNull();
      expect(parseNuclideNotation('Li-')).toBeNull();
    });

    it('should handle single-letter and two-letter elements', () => {
      expect(parseNuclideNotation('H-1')).toEqual({ element: 'H', massNumber: 1 });
      expect(parseNuclideNotation('Fe-56')).toEqual({ element: 'Fe', massNumber: 56 });
      expect(parseNuclideNotation('Pb-208')).toEqual({ element: 'Pb', massNumber: 208 });
    });
  });

  describe('formatNuclideNotation', () => {
    it('should format standard nuclides with hyphen', () => {
      expect(formatNuclideNotation('Li', 7)).toBe('Li-7');
      expect(formatNuclideNotation('U', 235)).toBe('U-235');
      expect(formatNuclideNotation('Fe', 56)).toBe('Fe-56');
    });

    it('should preserve deuterium shorthand', () => {
      expect(formatNuclideNotation('D', 2)).toBe('D');
    });

    it('should preserve tritium shorthand', () => {
      expect(formatNuclideNotation('T', 3)).toBe('T');
    });

    it('should format regular hydrogen with hyphen', () => {
      expect(formatNuclideNotation('H', 1)).toBe('H-1');
      expect(formatNuclideNotation('H', 3)).toBe('H-3');  // Not special T case
    });
  });

  describe('edge cases', () => {
    let mockDb: Database;

    beforeEach(() => {
      mockDb = createMockDatabase();
    });

    it('should handle elements with single isotope', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [['F', 19, 9, 100, 15]],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'F');

      expect(result).toHaveLength(1);
      expect(result[0].abundance).toBe(100);
      expect(result[0].abundanceTier).toBe('abundant');
    });

    it('should handle mixed stable and radioactive isotopes', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['K', 39, 19, 93.26, 15],    // Stable
            ['K', 40, 19, 0.01, 8.9],    // Radioactive (LHL < 9)
            ['K', 41, 19, 6.73, 15],     // Stable
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'K');

      expect(result.find((n) => n.A === 39)?.isStable).toBe(true);
      expect(result.find((n) => n.A === 40)?.isStable).toBe(false);
      expect(result.find((n) => n.A === 41)?.isStable).toBe(true);
    });

    it('should handle very small abundance values', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [['Pt', 190, 78, 0.01, 10]],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'Pt');

      expect(result[0].abundanceTier).toBe('rare');
      expect(formatAbundance(result[0].abundance)).toBe('0.010%');
    });

    it('should handle threshold boundary cases for abundance tiers', () => {
      vi.mocked(mockDb.exec).mockReturnValue([
        {
          columns: ['E', 'A', 'Z', 'pcaNCrust', 'LHL'],
          values: [
            ['X', 1, 1, 10.0, 10],    // Exactly 10% → abundant
            ['X', 2, 1, 9.99, 10],    // Just below 10% → trace
            ['X', 3, 1, 0.1, 10],     // Exactly 0.1% → trace
            ['X', 4, 1, 0.099, 10],   // Just below 0.1% → rare
          ],
        },
      ]);

      const result = getNuclidesForElement(mockDb, 'X');

      expect(result.find((n) => n.A === 1)?.abundanceTier).toBe('abundant');
      expect(result.find((n) => n.A === 2)?.abundanceTier).toBe('trace');
      expect(result.find((n) => n.A === 3)?.abundanceTier).toBe('trace');
      expect(result.find((n) => n.A === 4)?.abundanceTier).toBe('rare');
    });
  });
});
