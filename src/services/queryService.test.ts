import { describe, it, expect } from 'vitest';
import { getFusionSqlPreview } from './queryService';
import type { QueryFilter } from '../types';

describe('queryService', () => {
  describe('getFusionSqlPreview', () => {
    it('should generate basic SELECT with default ordering', () => {
      const filter: QueryFilter = {};
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('SELECT * FROM FusionAll');
      expect(sql).toContain('ORDER BY MeV DESC');
      expect(sql).toContain('LIMIT 100');
    });

    it('should include WHERE clause for element1List', () => {
      const filter: QueryFilter = {
        element1List: ['H', 'D'],
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("E1 IN ('H','D')");
    });

    it('should include WHERE clause for element2List', () => {
      const filter: QueryFilter = {
        element2List: ['Li', 'Ni'],
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("E2 IN ('Li','Ni')");
    });

    it('should include energy range filters', () => {
      const filter: QueryFilter = {
        minMeV: 1.0,
        maxMeV: 50.0,
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('MeV >= 1');
      expect(sql).toContain('MeV <= 50');
    });

    it('should include neutrino filter for none', () => {
      const filter: QueryFilter = {
        neutrinoType: 'none',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("neutrino = 'none'");
    });

    it('should include neutrino filter for left', () => {
      const filter: QueryFilter = {
        neutrinoType: 'left',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("neutrino = 'left'");
    });

    it('should include neutrino filter for right', () => {
      const filter: QueryFilter = {
        neutrinoType: 'right',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("neutrino = 'right'");
    });

    it('should include neutrino filter for left-right', () => {
      const filter: QueryFilter = {
        neutrinoType: 'left-right',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("neutrino IN ('left', 'right')");
    });

    it('should skip neutrino filter for any', () => {
      const filter: QueryFilter = {
        neutrinoType: 'any',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).not.toContain('neutrino');
    });

    it('should respect custom ordering', () => {
      const filter: QueryFilter = {
        orderBy: 'A1',
        orderDirection: 'asc',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('ORDER BY A1 ASC');
    });

    it('should cap limit at 1000', () => {
      const filter: QueryFilter = {
        limit: 5000,
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('LIMIT 1000');
    });

    it('should use specified limit when under 1000', () => {
      const filter: QueryFilter = {
        limit: 50,
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('LIMIT 50');
    });

    it('should combine multiple filters with AND', () => {
      const filter: QueryFilter = {
        element1List: ['H'],
        element2List: ['Li'],
        minMeV: 5.0,
        neutrinoType: 'none',
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('MeV >= 5');
      expect(sql).toContain("E1 IN ('H')");
      expect(sql).toContain("E2 IN ('Li')");
      expect(sql).toContain("neutrino = 'none'");
      expect(sql).toContain('AND');
    });

    it('should include output element filter', () => {
      const filter: QueryFilter = {
        outputElementList: ['Fe', 'Ni'],
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("E IN ('Fe','Ni')");
    });

    it('should include boson/fermion nuclear filter', () => {
      const filter: QueryFilter = {
        bosonFermionFilter: {
          nuclear: 'b',
          atomic: 'either',
        },
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("nBorF1 = 'b'");
    });

    it('should include boson/fermion atomic filter', () => {
      const filter: QueryFilter = {
        bosonFermionFilter: {
          nuclear: 'either',
          atomic: 'f',
        },
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("aBorF1 = 'f'");
    });

    it('should include both boson/fermion nuclear and atomic filters together', () => {
      const filter: QueryFilter = {
        bosonFermionFilter: {
          nuclear: 'b',
          atomic: 'f',
        },
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain("nBorF1 = 'b'");
      expect(sql).toContain("aBorF1 = 'f'");
    });

    it('should treat limit of 0 as default (100)', () => {
      const filter: QueryFilter = {
        limit: 0,
      };
      const sql = getFusionSqlPreview(filter);
      expect(sql).toContain('LIMIT 100');
    });
  });
});
