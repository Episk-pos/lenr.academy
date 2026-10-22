// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import initSqlJs, { type Database } from 'sql.js';
import { getNuclideHalfLives, getRadioactiveNuclideData } from './queryService';

/**
 * Real in-memory SQLite fixture mirroring how parkhomov.db stores hydrogen:
 * NuclidesPlus uses the distinct symbols H / D / T, while RadioNuclides files
 * tritium under 'H' (Z=1, A=3). Values are copied from parkhomov.db v1.2.2.
 */
let db: Database;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const SQL = await initSqlJs({
    locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
  });
  db = new SQL.Database();
  db.run(`
    CREATE TABLE NuclidesPlus (id INTEGER PRIMARY KEY, A INTEGER, Z INTEGER, E TEXT, LHL REAL);
    INSERT INTO NuclidesPlus VALUES (3, 1, 1, 'H', 50.0), (4, 2, 1, 'D', 50.0), (5, 3, 1, 'T', 1.0906);
    CREATE TABLE RadioNuclides (
      id INTEGER PRIMARY KEY, A INTEGER, E TEXT, Z INTEGER, RDM TEXT, HL REAL,
      Units TEXT, LHL REAL, RT TEXT, DEKeV REAL, RI REAL
    );
    INSERT INTO RadioNuclides VALUES (1, 3, 'H', 1, 'B-', 12.33, 'Y', 1.091, 'B-', 5.69, 100.0);
    INSERT INTO RadioNuclides VALUES (2, 60, 'Co', 27, 'B-', 5.2714, 'Y', 0.722, 'G', 1332.5, 99.98);
    INSERT INTO RadioNuclides VALUES (3, 60, 'Co', 27, 'B-', 5.2714, 'Y', 0.722, 'B-', 95.77, 99.88);
  `);
});

afterAll(() => {
  db?.close();
});

describe('getNuclideHalfLives', () => {
  it('finds the tritium (T-3) half-life by Z/A even though RadioNuclides stores it as H', () => {
    const halfLives = getNuclideHalfLives(db, [{ Z: 1, A: 3 }]);
    const t3 = halfLives.get('1-3');
    expect(t3).toBeDefined();
    expect(t3!.halfLife).toBeCloseTo(12.33, 2);
    expect(t3!.units).toBe('Y');
    expect(t3!.decayMode).toBe('B-');
  });

  it('omits stable hydrogen isotopes (H-1, D-2)', () => {
    const halfLives = getNuclideHalfLives(db, [
      { Z: 1, A: 1 },
      { Z: 1, A: 2 },
      { Z: 1, A: 3 },
    ]);
    expect(halfLives.has('1-1')).toBe(false);
    expect(halfLives.has('1-2')).toBe(false);
    expect(halfLives.has('1-3')).toBe(true);
  });

  it('keeps one (highest-intensity) record per nuclide', () => {
    const halfLives = getNuclideHalfLives(db, [{ Z: 27, A: 60 }]);
    expect(halfLives.size).toBe(1);
    expect(halfLives.get('27-60')!.halfLife).toBeCloseTo(5.2714, 4);
  });

  it('returns an empty map for an empty input', () => {
    expect(getNuclideHalfLives(db, []).size).toBe(0);
  });
});

describe('getRadioactiveNuclideData', () => {
  it('resolves the NuclidesPlus symbol T to the RadioNuclides H-3 record', () => {
    const data = getRadioactiveNuclideData(db, 'T', 3);
    expect(data).not.toBeNull();
    expect(data!.Z).toBe(1);
    expect(data!.halfLife).toBeCloseTo(12.33, 2);
    expect(data!.decayData.length).toBeGreaterThan(0);
  });

  it('returns null for stable deuterium (D-2)', () => {
    expect(getRadioactiveNuclideData(db, 'D', 2)).toBeNull();
  });
});
