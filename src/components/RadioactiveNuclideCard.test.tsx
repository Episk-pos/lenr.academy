import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="x-icon" />,
  ChevronDown: () => <svg data-testid="chevron-down" />,
  ChevronUp: () => <svg data-testid="chevron-up" />,
  ArrowRight: () => <svg data-testid="arrow-right" />,
  Radiation: () => <svg data-testid="radiation-icon" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({
    db: { exec: vi.fn() },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../services/queryService', () => ({
  getElementSymbolByZ: vi.fn((_, z: number) => {
    const symbols: Record<number, string> = { 90: 'Th', 92: 'U', 91: 'Pa', 93: 'Np' };
    return symbols[z] || `Z${z}`;
  }),
  getNuclideBySymbol: vi.fn(() => ({ Z: 90, A: 234, E: 'Th' })),
}));

vi.mock('../utils/formatUtils', () => ({
  expandHalfLifeUnit: vi.fn((unit: string) => {
    const units: Record<string, string> = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days', y: 'years' };
    return units[unit] || unit;
  }),
}));

import RadioactiveNuclideCard from './RadioactiveNuclideCard';

const baseNuclideData = {
  Z: 92,
  A: 238,
  E: 'U',
  RDM: 'A',
  logHalfLife: 9.15,
  halfLife: 4.468e9,
  Units: 'y',
  decayData: [
    {
      decayMode: 'A',
      radiationType: 'A',
      energyKeV: 4270,
      intensity: 100,
      halfLife: 4.468e9,
      halfLifeUnits: 'y',
    },
    {
      decayMode: 'A',
      radiationType: 'G',
      energyKeV: 49.55,
      intensity: 0.064,
      halfLife: 4.468e9,
      halfLifeUnits: 'y',
    },
  ],
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RadioactiveNuclideCard', () => {
  it('renders nuclide header', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText('U-238')).toBeInTheDocument();
  });

  it('shows atomic and mass numbers', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText(/Atomic Number: 92/)).toBeInTheDocument();
    expect(screen.getByText(/Mass Number: 238/)).toBeInTheDocument();
  });

  it('shows limited data banner', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText(/Limited Data Available/)).toBeInTheDocument();
  });

  it('shows nuclear properties', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText('Nuclear Properties')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('shows stability section', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText('Stability')).toBeInTheDocument();
    expect(screen.getByText('Primary Decay Mode:')).toBeInTheDocument();
  });

  it('shows decay data table', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText('Radioactive Decay')).toBeInTheDocument();
    expect(screen.getByText('Decay Mode')).toBeInTheDocument();
    expect(screen.getByText('Radiation')).toBeInTheDocument();
  });

  it('shows close button when onClose provided', () => {
    const onClose = vi.fn();
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close nuclide details');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show close button when onClose not provided', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.queryByTitle('Close nuclide details')).toBeNull();
  });

  it('shows expand button when more than 4 decay entries', () => {
    const manyDecays = {
      ...baseNuclideData,
      decayData: Array.from({ length: 6 }, (_, i) => ({
        decayMode: 'A',
        radiationType: i % 2 === 0 ? 'A' : 'G',
        energyKeV: 4270 + i * 10,
        intensity: 100 - i * 10,
        halfLife: 4.468e9,
        halfLifeUnits: 'y',
      })),
    };
    renderWithRouter(<RadioactiveNuclideCard nuclideData={manyDecays} />);
    expect(screen.getByText(/Show 2 more decay modes/)).toBeInTheDocument();
  });

  it('shows radiation type legend', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    expect(screen.getByText('Radiation Type Legend')).toBeInTheDocument();
  });

  it('shows neutron count', () => {
    renderWithRouter(<RadioactiveNuclideCard nuclideData={baseNuclideData} />);
    // N = A - Z = 238 - 92 = 146
    expect(screen.getByText('146')).toBeInTheDocument();
  });
});
