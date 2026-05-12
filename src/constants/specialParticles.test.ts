import { describe, it, expect } from 'vitest';
import {
  SPECIAL_PARTICLES,
  SPECIAL_PARTICLE_IDS,
  SPECIAL_PARTICLES_BY_ID,
} from './specialParticles';

describe('specialParticles', () => {
  it('defines three special particles', () => {
    expect(SPECIAL_PARTICLES).toHaveLength(3);
  });

  it('includes electron', () => {
    const electron = SPECIAL_PARTICLES.find(p => p.id === 'e-');
    expect(electron).toBeDefined();
    expect(electron!.name).toBe('Electron');
    expect(electron!.displaySymbol).toBe('e⁻');
    expect(electron!.charge).toBe(-1);
    expect(electron!.atomicNumber).toBe(-1);
    expect(electron!.massNumber).toBe(0);
  });

  it('includes neutron', () => {
    const neutron = SPECIAL_PARTICLES.find(p => p.id === 'n*');
    expect(neutron).toBeDefined();
    expect(neutron!.name).toBe('Neutron');
    expect(neutron!.charge).toBe(0);
    expect(neutron!.massNumber).toBe(1);
  });

  it('includes neutrino', () => {
    const neutrino = SPECIAL_PARTICLES.find(p => p.id === 'nu');
    expect(neutrino).toBeDefined();
    expect(neutrino!.name).toBe('Neutrino');
    expect(neutrino!.displaySymbol).toBe('ν');
    expect(neutrino!.charge).toBe(0);
    expect(neutrino!.massNumber).toBe(0);
  });

  it('SPECIAL_PARTICLE_IDS contains all IDs', () => {
    expect(SPECIAL_PARTICLE_IDS).toEqual(['e-', 'n*', 'nu']);
  });

  it('SPECIAL_PARTICLES_BY_ID maps correctly', () => {
    expect(SPECIAL_PARTICLES_BY_ID['e-'].name).toBe('Electron');
    expect(SPECIAL_PARTICLES_BY_ID['n*'].name).toBe('Neutron');
    expect(SPECIAL_PARTICLES_BY_ID['nu'].name).toBe('Neutrino');
  });

  it('all particles have position data for periodic table', () => {
    SPECIAL_PARTICLES.forEach(p => {
      expect(p.position).toBeDefined();
      expect(p.position.period).toBeGreaterThan(0);
      expect(p.position.group).toBeGreaterThan(0);
    });
  });
});
