import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParticleDetailsCard from './ParticleDetailsCard';
import type { Nuclide } from '../types';
import type { SpecialParticleInfo } from '../constants/specialParticles';

const mockParticle: SpecialParticleInfo = {
  id: 'e-',
  name: 'Electron',
  displaySymbol: 'e⁻',
  description: 'A fundamental lepton with negative charge.',
  atomicNumber: -1,
  massNumber: 0,
  charge: -1,
  position: { period: 2, group: 5 },
};

const mockNuclide: Nuclide = {
  id: 0,
  Z: 0,
  A: 0,
  E: 'e-',
  BE: 0,
  AMU: 0.000549,
  SP: '1/2',
  MD: '-1.001',
  nBorF: 'f',
  aBorF: 'f',
};

describe('ParticleDetailsCard', () => {
  it('renders null when nuclide is null', () => {
    const { container } = render(
      <ParticleDetailsCard particle={mockParticle} nuclide={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders particle name and symbol', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('Electron')).toBeInTheDocument();
    expect(screen.getByText('e⁻')).toBeInTheDocument();
  });

  it('renders particle description', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText(/fundamental lepton/i)).toBeInTheDocument();
  });

  it('shows charge with correct formatting', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('shows zero charge as 0', () => {
    const neutralParticle = { ...mockParticle, charge: 0 };
    // Use nuclide with non-zero Z and A so '0' only appears for charge
    const nonZeroNuclide = { ...mockNuclide, Z: 1, A: 1 };
    render(<ParticleDetailsCard particle={neutralParticle} nuclide={nonZeroNuclide} />);
    // The charge field should show '0'
    const chargeLabel = screen.getByText('Charge');
    const chargeValue = chargeLabel.closest('div')?.querySelector('.font-semibold');
    expect(chargeValue).toHaveTextContent('0');
  });

  it('shows spin value', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('shows mass in AMU', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('0.000549')).toBeInTheDocument();
  });

  it('shows Fermion classification for nBorF=f', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    const fermionLabels = screen.getAllByText('Fermion');
    expect(fermionLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Boson classification for nBorF=b', () => {
    const bosonNuclide = { ...mockNuclide, nBorF: 'b' as const, aBorF: 'b' as const };
    render(<ParticleDetailsCard particle={mockParticle} nuclide={bosonNuclide} />);
    const bosonLabels = screen.getAllByText('Boson');
    expect(bosonLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows database mapping with Z and A values', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('e-')).toBeInTheDocument();
    // Z and A are 0 for electron
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('shows magnetic moment', () => {
    render(<ParticleDetailsCard particle={mockParticle} nuclide={mockNuclide} />);
    expect(screen.getByText('-1.001')).toBeInTheDocument();
  });
});
