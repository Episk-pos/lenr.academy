import { describe, it, expect } from 'vitest';
import { EXAMPLE_QUERIES } from './exampleQueries';

describe('exampleQueries', () => {
  it('has a non-empty set of queries', () => {
    expect(EXAMPLE_QUERIES.length).toBeGreaterThan(0);
  });

  it('all entries have required fields', () => {
    EXAMPLE_QUERIES.forEach(query => {
      expect(query.name).toBeTruthy();
      expect(query.description).toBeTruthy();
      expect(['fusion', 'fission', 'twotwo', 'element-data', 'cascades', 'muller-resonance']).toContain(query.queryType);
      expect(query.filter).toBeDefined();
    });
  });

  it('includes fusion examples', () => {
    const fusion = EXAMPLE_QUERIES.filter(q => q.queryType === 'fusion');
    expect(fusion.length).toBeGreaterThan(0);
  });

  it('includes fission examples', () => {
    const fission = EXAMPLE_QUERIES.filter(q => q.queryType === 'fission');
    expect(fission.length).toBeGreaterThan(0);
  });

  it('includes twotwo examples', () => {
    const twotwo = EXAMPLE_QUERIES.filter(q => q.queryType === 'twotwo');
    expect(twotwo.length).toBeGreaterThan(0);
  });

  it('includes element-data examples', () => {
    const elementData = EXAMPLE_QUERIES.filter(q => q.queryType === 'element-data');
    expect(elementData.length).toBeGreaterThan(0);
    elementData.forEach(q => {
      expect(q.elementZ).toBeDefined();
    });
  });

  it('includes cascades example', () => {
    const cascades = EXAMPLE_QUERIES.filter(q => q.queryType === 'cascades');
    expect(cascades.length).toBeGreaterThan(0);
    cascades.forEach(q => {
      expect(q.materialId).toBeTruthy();
    });
  });

  it('includes muller-resonance example', () => {
    const muller = EXAMPLE_QUERIES.filter(q => q.queryType === 'muller-resonance');
    expect(muller.length).toBeGreaterThan(0);
    muller.forEach(q => {
      expect(q.mullerParams).toBeDefined();
    });
  });

  it('includes H-Li fusion example', () => {
    const hli = EXAMPLE_QUERIES.find(q =>
      q.element1List?.includes('H') && q.element2List?.includes('Li')
    );
    expect(hli).toBeDefined();
    expect(hli!.queryType).toBe('fusion');
  });
});
