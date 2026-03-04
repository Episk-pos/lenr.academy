import { describe, it, expect } from 'vitest';
import { RADIATION_TYPE_INFO } from './radiationTypes';

describe('radiationTypes', () => {
  it('includes primary decay modes', () => {
    expect(RADIATION_TYPE_INFO['A']).toBeDefined();
    expect(RADIATION_TYPE_INFO['A'].name).toBe('Alpha particle');
    expect(RADIATION_TYPE_INFO['B-']).toBeDefined();
    expect(RADIATION_TYPE_INFO['B+']).toBeDefined();
    expect(RADIATION_TYPE_INFO['EC']).toBeDefined();
    expect(RADIATION_TYPE_INFO['IT']).toBeDefined();
  });

  it('includes gamma radiation types', () => {
    expect(RADIATION_TYPE_INFO['G']).toBeDefined();
    expect(RADIATION_TYPE_INFO['G'].name).toBe('Gamma ray');
    expect(RADIATION_TYPE_INFO['G-AN']).toBeDefined();
  });

  it('includes X-ray types', () => {
    expect(RADIATION_TYPE_INFO['G-X-K']).toBeDefined();
    expect(RADIATION_TYPE_INFO['G-X-KA1']).toBeDefined();
    expect(RADIATION_TYPE_INFO['G-X-L']).toBeDefined();
  });

  it('includes conversion electrons', () => {
    expect(RADIATION_TYPE_INFO['E-CE-K']).toBeDefined();
    expect(RADIATION_TYPE_INFO['E-CE-L']).toBeDefined();
    expect(RADIATION_TYPE_INFO['E-CE-M']).toBeDefined();
  });

  it('includes Auger electrons', () => {
    expect(RADIATION_TYPE_INFO['E-AU-K']).toBeDefined();
    expect(RADIATION_TYPE_INFO['E-AU-L']).toBeDefined();
  });

  it('all entries have required fields', () => {
    Object.entries(RADIATION_TYPE_INFO).forEach(([_key, info]) => {
      expect(info.name).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(info.url).toMatch(/^https:\/\//);
      expect(info.category).toBeTruthy();
    });
  });

  it('has correct categories', () => {
    const categories = new Set(Object.values(RADIATION_TYPE_INFO).map(i => i.category));
    expect(categories.has('primary')).toBe(true);
    expect(categories.has('gamma')).toBe(true);
    expect(categories.has('xray')).toBe(true);
    expect(categories.has('electron')).toBe(true);
  });
});
