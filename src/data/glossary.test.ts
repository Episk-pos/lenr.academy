import { describe, it, expect } from 'vitest';
import { GLOSSARY } from './glossary';

describe('glossary', () => {
  it('has a non-empty glossary', () => {
    expect(GLOSSARY.length).toBeGreaterThan(0);
  });

  it('all entries have required fields', () => {
    GLOSSARY.forEach(entry => {
      expect(entry.term).toBeTruthy();
      expect(entry.definition).toBeTruthy();
      expect(['nuclear', 'reaction', 'database', 'measurement']).toContain(entry.category);
    });
  });

  it('has entries in all categories', () => {
    const categories = new Set(GLOSSARY.map(e => e.category));
    expect(categories.has('nuclear')).toBe(true);
    expect(categories.has('reaction')).toBe(true);
    expect(categories.has('database')).toBe(true);
  });

  it('includes key nuclear physics terms', () => {
    const terms = GLOSSARY.map(e => e.term);
    expect(terms).toContain('Nuclide');
    expect(terms).toContain('Isotope');
    expect(terms).toContain('Half-Life');
  });

  it('includes reaction type terms', () => {
    const terms = GLOSSARY.map(e => e.term);
    expect(terms).toContain('Fusion');
    expect(terms).toContain('Fission');
  });

  it('includes MeV term', () => {
    const mev = GLOSSARY.find(e => e.term === 'MeV');
    expect(mev).toBeDefined();
    expect(mev!.category).toBe('measurement');
  });

  it('has unique terms', () => {
    const terms = GLOSSARY.map(e => e.term);
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
  });

  it('some entries have related terms', () => {
    const withRelated = GLOSSARY.filter(e => e.relatedTerms && e.relatedTerms.length > 0);
    expect(withRelated.length).toBeGreaterThan(0);
  });
});
