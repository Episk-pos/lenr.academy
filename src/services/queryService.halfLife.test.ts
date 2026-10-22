// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database } from 'sql.js';
import { createRadioNuclidesFixtureDb } from '../test-utils/radioNuclidesFixture';
import { getNuclideHalfLives, getRadioactiveNuclideData } from './queryService';

// Real parkhomov.db rows, including Co-60m / Cs-135m / Ba-137m isomer rows
let db: Database;

beforeAll(async () => {
  db = await createRadioNuclidesFixtureDb();
});

/** Look up one nuclide the way the UI does: with its NuclidesPlus LHL */
function groundState(Z: number, A: number) {
  const result = db.exec('SELECT LHL FROM NuclidesPlus WHERE Z = ? AND A = ?', [Z, A]);
  const lhl = result.length > 0 ? (result[0].values[0][0] as number) : null;
  return getNuclideHalfLives(db, [{ Z, A, logHalfLife: lhl }]).get(`${Z}-${A}`);
}

afterAll(() => {
  db?.close();
});

describe('getNuclideHalfLives', () => {
  it('finds the tritium (T-3) half-life by Z/A even though RadioNuclides stores it as H', () => {
    const t3 = groundState(1, 3);
    expect(t3).toBeDefined();
    expect(t3!.halfLife).toBeCloseTo(12.33, 2);
    expect(t3!.units).toBe('Y');
    expect(t3!.decayMode).toBe('B-');
  });

  it('picks the Co-60 ground state (5.2714 Y), not the more intense Co-60m IT row', () => {
    const co60 = groundState(27, 60);
    expect(co60).toBeDefined();
    expect(co60!.halfLife).toBeCloseTo(5.2714, 4);
    expect(co60!.units).toBe('Y');
    expect(co60!.decayMode).toBe('B-');
  });

  it('picks the long Cs-135 half-life (2.3e6 Y), not the 53 M isomer', () => {
    const cs135 = groundState(55, 135);
    expect(cs135!.halfLife).toBe(2300000);
    expect(cs135!.units).toBe('Y');
  });

  it('returns the U-238 ground state (4.47e9 Y, alpha)', () => {
    const u238 = groundState(92, 238);
    expect(u238!.halfLife).toBe(4470000000);
    expect(u238!.units).toBe('Y');
    expect(u238!.decayMode).toBe('A');
  });

  it('treats stable Ba-137 (LHL sentinel 50) as stable despite Ba-137m IT rows', () => {
    expect(groundState(56, 137)).toBeUndefined();
  });

  it('omits nuclides whose LHL matches no RadioNuclides row (Ta-180m vs Ta-180 8.15 h)', () => {
    expect(groundState(73, 180)).toBeUndefined();
  });

  it('omits stable hydrogen isotopes (H-1, D-2)', () => {
    expect(groundState(1, 1)).toBeUndefined();
    expect(groundState(1, 2)).toBeUndefined();
  });

  it('batches several nuclides in one call', () => {
    const halfLives = getNuclideHalfLives(db, [
      { Z: 1, A: 2, logHalfLife: 50 },
      { Z: 1, A: 3, logHalfLife: 1.0906 },
      { Z: 27, A: 60, logHalfLife: 0.7219 },
      { Z: 56, A: 137, logHalfLife: 50 },
    ]);
    expect([...halfLives.keys()].sort()).toEqual(['1-3', '27-60']);
  });

  it('uses the most intense row only when the nuclide has no NuclidesPlus LHL', () => {
    const co60 = getNuclideHalfLives(db, [{ Z: 27, A: 60 }]).get('27-60');
    expect(co60!.decayMode).toBe('IT');
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
