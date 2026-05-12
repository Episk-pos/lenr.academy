import { describe, it, expect } from 'vitest';
import { DECAY_SERIES_PRESETS } from './decaySeries';

describe('decaySeries', () => {
  it('defines four decay series presets', () => {
    expect(DECAY_SERIES_PRESETS).toHaveLength(4);
  });

  it('includes Uranium-238 series', () => {
    const u238 = DECAY_SERIES_PRESETS.find(s => s.id === 'uranium-238');
    expect(u238).toBeDefined();
    expect(u238!.parent.Z).toBe(92);
    expect(u238!.parent.A).toBe(238);
    expect(u238!.stableEndpoint.E).toBe('Pb');
    expect(u238!.stableEndpoint.A).toBe(206);
    expect(u238!.expectedGenerations).toBe(14);
  });

  it('includes Thorium-232 series', () => {
    const th232 = DECAY_SERIES_PRESETS.find(s => s.id === 'thorium-232');
    expect(th232).toBeDefined();
    expect(th232!.parent.Z).toBe(90);
    expect(th232!.parent.A).toBe(232);
    expect(th232!.stableEndpoint.A).toBe(208);
  });

  it('includes Uranium-235 (Actinium) series', () => {
    const u235 = DECAY_SERIES_PRESETS.find(s => s.id === 'uranium-235');
    expect(u235).toBeDefined();
    expect(u235!.parent.A).toBe(235);
    expect(u235!.stableEndpoint.A).toBe(207);
  });

  it('includes Neptunium-237 series', () => {
    const np237 = DECAY_SERIES_PRESETS.find(s => s.id === 'neptunium-237');
    expect(np237).toBeDefined();
    expect(np237!.parent.Z).toBe(93);
    expect(np237!.parent.A).toBe(237);
  });

  it('all presets have required fields', () => {
    DECAY_SERIES_PRESETS.forEach(preset => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.parent.Z).toBeGreaterThan(0);
      expect(preset.parent.A).toBeGreaterThan(0);
      expect(preset.stableEndpoint.Z).toBeGreaterThan(0);
      expect(preset.description).toBeTruthy();
      expect(preset.characteristics.length).toBeGreaterThan(0);
      expect(preset.wikipediaUrl).toMatch(/^https:\/\//);
    });
  });

  it('all presets follow 4n+k naming convention', () => {
    const names = DECAY_SERIES_PRESETS.map(p => p.name);
    expect(names.some(n => n.includes('4n+2'))).toBe(true);
    expect(names.some(n => n.includes('4n)'))).toBe(true);
    expect(names.some(n => n.includes('4n+3'))).toBe(true);
    expect(names.some(n => n.includes('4n+1'))).toBe(true);
  });
});
