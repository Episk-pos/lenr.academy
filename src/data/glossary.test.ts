import { describe, it, expect } from 'vitest';
import { GLOSSARY, localizeGlossaryEntry } from './glossary';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';

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

  describe('LENR-specific entries (NAE, Compton, Muller, catalytic cycle, dimer)', () => {
    const NEW_TERMS = [
      'NAE (Nuclear Active Environment)',
      'Compton Wavelength',
      'Muller Resonance',
      'Catalytic Cycle',
      'Dimer',
    ];

    const lookup = (locale: unknown, key: string): unknown =>
      key.split('.').reduce<unknown>(
        (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
        locale
      );

    it('includes all new terms with an i18n key', () => {
      NEW_TERMS.forEach(term => {
        const entry = GLOSSARY.find(e => e.term === term);
        expect(entry, term).toBeDefined();
        expect(entry!.i18nKey, term).toMatch(/^help\.glossaryTerms\./);
      });
    });

    it('English locale text matches the glossary source text', () => {
      GLOSSARY.filter(e => e.i18nKey).forEach(entry => {
        expect(lookup(en, `${entry.i18nKey}.term`)).toBe(entry.term);
        expect(lookup(en, `${entry.i18nKey}.definition`)).toBe(entry.definition);
      });
    });

    it('states the Muller resonance ratio and octave gap', () => {
      const muller = GLOSSARY.find(e => e.term === 'Muller Resonance')!;
      expect(muller.definition).toContain('Z₁/Z₂ ≈ 2^ΔN / 1836.15');
      expect(muller.definition).toContain('octave gap ΔN');
    });

    it('related terms of new entries point at existing glossary terms', () => {
      const terms = new Set(GLOSSARY.map(e => e.term));
      GLOSSARY.filter(e => e.i18nKey).forEach(entry => {
        entry.relatedTerms?.forEach(rel => expect(terms.has(rel), `${entry.term} -> ${rel}`).toBe(true));
      });
    });

    it('localizeGlossaryEntry resolves translated text, falling back to English source', () => {
      const translateDe = (key: string) => String(lookup(de, key) ?? key);
      const nae = GLOSSARY.find(e => e.term === 'NAE (Nuclear Active Environment)')!;
      const localized = localizeGlossaryEntry(nae, translateDe);
      expect(localized.term).toBe(lookup(de, 'help.glossaryTerms.nae.term'));
      expect(localized.definition).not.toBe(nae.definition);

      const nuclide = GLOSSARY.find(e => e.term === 'Nuclide')!;
      expect(localizeGlossaryEntry(nuclide, translateDe)).toEqual({
        term: nuclide.term,
        definition: nuclide.definition,
      });
    });
  });
});
