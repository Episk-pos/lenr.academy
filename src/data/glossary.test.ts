import { describe, it, expect } from 'vitest';
import { GLOSSARY, localizeGlossaryEntry, localizeRelatedTerm, matchesGlossarySearch } from './glossary';
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

    it('states the Muller resonance ratio and octave gap', () => {
      const muller = GLOSSARY.find(e => e.term === 'Muller Resonance')!;
      expect(muller.definition).toContain('Z₁/Z₂ ≈ 2^ΔN / 1836.15');
      expect(muller.definition).toContain('octave gap ΔN');
    });

    it('related terms of new entries point at existing glossary terms', () => {
      const terms = new Set(GLOSSARY.map(e => e.term));
      GLOSSARY.filter(e => NEW_TERMS.includes(e.term)).forEach(entry => {
        entry.relatedTerms?.forEach(rel => expect(terms.has(rel), `${entry.term} -> ${rel}`).toBe(true));
      });
    });

    it('localizeGlossaryEntry resolves translated text', () => {
      const translateDe = (key: string) => String(lookup(de, key) ?? key);
      const nae = GLOSSARY.find(e => e.term === 'NAE (Nuclear Active Environment)')!;
      const localized = localizeGlossaryEntry(nae, translateDe);
      expect(localized.term).toBe(lookup(de, 'help.glossaryTerms.nae.term'));
      expect(localized.definition).not.toBe(nae.definition);
    });
  });

  describe('localization', () => {
    const lookup = (locale: unknown, key: string): unknown =>
      key.split('.').reduce<unknown>(
        (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
        locale
      );
    const translateEn = (key: string) => String(lookup(en, key) ?? key);
    // Stand-in for a translated locale: prefixes every glossary string so it is
    // distinguishable from the English source.
    const translateXx = (key: string) => `xx:${translateEn(key)}`;

    it('every entry has a unique help.glossaryTerms i18n key', () => {
      const keys = GLOSSARY.map(e => e.i18nKey);
      keys.forEach(key => expect(key).toMatch(/^help\.glossaryTerms\.[a-z][A-Za-z]*$/));
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('English locale text matches the glossary source text for every entry', () => {
      GLOSSARY.forEach(entry => {
        expect(lookup(en, `${entry.i18nKey}.term`), entry.term).toBe(entry.term);
        expect(lookup(en, `${entry.i18nKey}.definition`), entry.term).toBe(entry.definition);
      });
    });

    it('localizeGlossaryEntry returns the translated term and definition', () => {
      const nuclide = GLOSSARY.find(e => e.term === 'Nuclide')!;
      expect(localizeGlossaryEntry(nuclide, translateXx)).toEqual({
        term: `xx:${nuclide.term}`,
        definition: `xx:${nuclide.definition}`,
      });
    });

    it('localizeRelatedTerm shows the localized term of the referenced entry', () => {
      expect(localizeRelatedTerm('Isotope', translateXx)).toBe('xx:Isotope');
      expect(localizeRelatedTerm('NAE (Nuclear Active Environment)', translateEn)).toBe(
        en.help.glossaryTerms.nae.term
      );
    });

    it('only the known dangling related terms have no glossary entry', () => {
      // These chips fall back to the raw English string until entries exist.
      const terms = new Set(GLOSSARY.map(e => e.term));
      const dangling = new Set(GLOSSARY.flatMap(e => e.relatedTerms ?? []).filter(rel => !terms.has(rel)));
      expect([...dangling].sort()).toEqual(['Element', 'Neutron', 'Nucleon', 'Weak Force']);
    });

    it('localizeRelatedTerm falls back to the raw string when no entry matches', () => {
      expect(localizeRelatedTerm('Not A Glossary Term', translateXx)).toBe('Not A Glossary Term');
    });

    it('matchesGlossarySearch matches localized term, localized definition and English term', () => {
      const fusion = GLOSSARY.find(e => e.term === 'Fusion')!;
      const translate = (key: string) =>
        key === `${fusion.i18nKey}.term` ? 'Kernfusion' : key === `${fusion.i18nKey}.definition` ? 'leichtere Kerne' : key;
      expect(matchesGlossarySearch(fusion, 'kernfusion', translate)).toBe(true);
      expect(matchesGlossarySearch(fusion, 'LEICHTERE', translate)).toBe(true);
      expect(matchesGlossarySearch(fusion, 'fusion', translate)).toBe(true);
      expect(matchesGlossarySearch(fusion, 'lighter nuclei', translate)).toBe(false);
    });
  });
});
