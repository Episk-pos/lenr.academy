import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import ElementDetailsCard from './ElementDetailsCard';
import type { Element } from '../types';

const mockElement: Element = {
  Z: 26,
  E: 'Fe',
  EName: 'Iron',
  Period: 4,
  Group: 8,
  AWeight: 55.845,
  Valence: 3,
  Negativity: 1.83,
  Affinity: 15.7,
  MaxIonNum: 6,
  MaxIonization: 7902.5,
  Melting: 1811.0,
  Boiling: 3134.0,
  SpecHeat: 0.449,
  ThermConduct: 80.4,
  STPDensity: 7.874,
  MolarVolume: 7.09,
  ElectConduct: 10.0,
  MagType: 'Ferromagnetic',
};

const mockRadii = {
  empirical: 126,
  calculated: 156,
  vanDerWaals: null,
  covalent: 132,
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ElementDetailsCard', () => {
  it('returns null when element is null', () => {
    const { container } = renderWithRouter(<ElementDetailsCard element={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders element name and symbol', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.getByText(/Iron \(Fe\)/)).toBeInTheDocument();
  });

  it('renders atomic number', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    const zTexts = screen.getAllByText('26');
    expect(zTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders element link to element-data page', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    const link = screen.getByRole('link', { name: /Iron \(Fe\)/ });
    expect(link).toHaveAttribute('href', '/element-data?Z=26');
  });

  it('renders periodic table properties', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.getByText('4')).toBeInTheDocument(); // Period
    expect(screen.getByText('8')).toBeInTheDocument(); // Group
    expect(screen.getByText('55.845')).toBeInTheDocument(); // Atomic weight
  });

  it('renders atomic properties', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // Valence
    expect(screen.getByText('1.83')).toBeInTheDocument(); // Electronegativity
    expect(screen.getByText(/15.7 kJ\/mol/)).toBeInTheDocument(); // Electron affinity
  });

  it('renders thermal properties', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.getByText(/1811.00 K/)).toBeInTheDocument(); // Melting
    expect(screen.getByText(/3134.00 K/)).toBeInTheDocument(); // Boiling
  });

  it('renders physical properties', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.getByText(/7.874 g\/cm/)).toBeInTheDocument(); // Density
    expect(screen.getByText('Ferromagnetic')).toBeInTheDocument(); // MagType
  });

  it('renders close button when onClose provided', () => {
    const onClose = vi.fn();
    renderWithRouter(<ElementDetailsCard element={mockElement} onClose={onClose} />);
    const closeBtn = screen.getByTitle(/close/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render close button when onClose not provided', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.queryByTitle(/close/i)).not.toBeInTheDocument();
  });

  it('renders atomic radii when provided', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} atomicRadii={mockRadii} />);
    expect(screen.getByText('126 pm')).toBeInTheDocument(); // Empirical
    expect(screen.getByText('156 pm')).toBeInTheDocument(); // Calculated
    expect(screen.getByText('132 pm')).toBeInTheDocument(); // Covalent
  });

  it('does not render radii section when not provided', () => {
    renderWithRouter(<ElementDetailsCard element={mockElement} />);
    expect(screen.queryByText(/126 pm/)).not.toBeInTheDocument();
  });

  it('skips optional properties when null', () => {
    const minimal: Element = {
      Z: 1,
      E: 'H',
      EName: 'Hydrogen',
      Period: 1,
      Group: 1,
      AWeight: null as any,
      Valence: null as any,
      Negativity: null as any,
      Affinity: null as any,
      MaxIonNum: null as any,
      MaxIonization: null as any,
      Melting: null as any,
      Boiling: null as any,
      SpecHeat: null as any,
      ThermConduct: null as any,
      STPDensity: null as any,
      MolarVolume: null as any,
      ElectConduct: null as any,
      MagType: null as any,
    };
    renderWithRouter(<ElementDetailsCard element={minimal} />);
    expect(screen.getByText(/Hydrogen \(H\)/)).toBeInTheDocument();
    // Should not throw and should still render basic info
    // Z=1, Period=1, Group=1 all appear as "1"
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(3);
  });
});
