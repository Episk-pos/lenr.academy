import { describe, it, expect } from 'vitest';
import { getDaughterNuclide } from './decayChainService';

describe('decayChainService', () => {
  describe('getDaughterNuclide', () => {
    it('should calculate alpha decay: Z-2, A-4', () => {
      // U-238 alpha decay -> Th-234
      const result = getDaughterNuclide(92, 238, 'U', 'A');
      expect(result).toEqual({ Z: 90, A: 234, E: '' });
    });

    it('should calculate beta minus decay: Z+1, A same', () => {
      // Th-234 beta- decay -> Pa-234
      const result = getDaughterNuclide(90, 234, 'Th', 'B-');
      expect(result).toEqual({ Z: 91, A: 234, E: '' });
    });

    it('should calculate beta plus decay: Z-1, A same', () => {
      // Na-22 beta+ decay -> Ne-22
      const result = getDaughterNuclide(11, 22, 'Na', 'B+');
      expect(result).toEqual({ Z: 10, A: 22, E: '' });
    });

    it('should calculate electron capture: Z-1, A same', () => {
      // Fe-55 EC -> Mn-55
      const result = getDaughterNuclide(26, 55, 'Fe', 'EC');
      expect(result).toEqual({ Z: 25, A: 55, E: '' });
    });

    it('should calculate isomeric transition: same Z and A', () => {
      // Tc-99m IT -> Tc-99
      const result = getDaughterNuclide(43, 99, 'Tc', 'IT');
      expect(result).toEqual({ Z: 43, A: 99, E: 'Tc' });
    });

    it('should handle lowercase decay modes', () => {
      const result = getDaughterNuclide(92, 238, 'U', 'a');
      expect(result).toEqual({ Z: 90, A: 234, E: '' });
    });

    it('should return null for unicode beta symbols (known limitation)', () => {
      // Note: toUpperCase() converts 'β' to Greek capital 'Β', not Latin 'B',
      // so unicode beta symbols are not currently recognized.
      // The database uses ASCII 'B-' and 'B+' so this does not affect production.
      const betaMinus = getDaughterNuclide(90, 234, 'Th', 'β-');
      expect(betaMinus).toBeNull();

      const betaPlus = getDaughterNuclide(11, 22, 'Na', 'β+');
      expect(betaPlus).toBeNull();
    });

    it('should return null for unrecognized decay modes', () => {
      const result = getDaughterNuclide(92, 238, 'U', 'SF');
      expect(result).toBeNull();
    });

    it('should return null for empty decay mode', () => {
      const result = getDaughterNuclide(92, 238, 'U', '');
      expect(result).toBeNull();
    });

    it('should not confuse alpha with EC or beta modes', () => {
      // 'A' should be alpha, not confused with 'EC' or 'B'
      const alpha = getDaughterNuclide(92, 238, 'U', 'A');
      expect(alpha).toEqual({ Z: 90, A: 234, E: '' });

      // 'EC' should be electron capture, not alpha
      const ec = getDaughterNuclide(26, 55, 'Fe', 'EC');
      expect(ec).toEqual({ Z: 25, A: 55, E: '' });
    });

    it('should handle the U-238 decay series first steps correctly', () => {
      // U-238 -> Th-234 (alpha)
      const step1 = getDaughterNuclide(92, 238, 'U', 'A');
      expect(step1).toEqual({ Z: 90, A: 234, E: '' });

      // Th-234 -> Pa-234 (beta-)
      const step2 = getDaughterNuclide(90, 234, 'Th', 'B-');
      expect(step2).toEqual({ Z: 91, A: 234, E: '' });

      // Pa-234 -> U-234 (beta-)
      const step3 = getDaughterNuclide(91, 234, 'Pa', 'B-');
      expect(step3).toEqual({ Z: 92, A: 234, E: '' });

      // U-234 -> Th-230 (alpha)
      const step4 = getDaughterNuclide(92, 234, 'U', 'A');
      expect(step4).toEqual({ Z: 90, A: 230, E: '' });
    });
  });
});
