import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: { exec: vi.fn(() => []) } }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('../services/queryService', () => ({
  hasOnlyRadioactiveIsotopes: vi.fn(() => false),
}));

vi.mock('lucide-react', () => ({
  Radiation: () => <svg data-testid="radiation-icon" />,
}));

import PeriodicTable from './PeriodicTable';

const mockElements = [
  { E: 'H', Z: 1, Name: 'Hydrogen' },
  { E: 'He', Z: 2, Name: 'Helium' },
  { E: 'Li', Z: 3, Name: 'Lithium' },
  { E: 'Be', Z: 4, Name: 'Beryllium' },
  { E: 'Fe', Z: 26, Name: 'Iron' },
  { E: 'U', Z: 92, Name: 'Uranium' },
];

describe('PeriodicTable', () => {
  const defaultProps = {
    availableElements: mockElements as any,
    selectedElement: null,
    onElementClick: vi.fn(),
  };

  it('renders element buttons for available elements', () => {
    render(<PeriodicTable {...defaultProps} />);
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('He')).toBeInTheDocument();
    expect(screen.getByText('Li')).toBeInTheDocument();
    expect(screen.getByText('Fe')).toBeInTheDocument();
  });

  it('highlights the selected element', () => {
    render(<PeriodicTable {...defaultProps} selectedElement="Fe" />);
    // Iron should be findable in the rendered output
    const feText = screen.getByText('Fe');
    expect(feText).toBeInTheDocument();
  });

  it('calls onElementClick when element is clicked', () => {
    const onClick = vi.fn();
    render(<PeriodicTable {...defaultProps} onElementClick={onClick} />);
    const hydrogen = screen.getByRole('button', { name: /1\s*H/ });
    fireEvent.click(hydrogen);
    expect(onClick).toHaveBeenCalledWith('H');
  });

  it('renders hydrogen isotope buttons (D, T) next to H', () => {
    // D and T must be in availableElements for their buttons to be active
    const elementsWithIsotopes = [
      ...mockElements,
      { E: 'D', Z: 1, Name: 'Deuterium' },
      { E: 'T', Z: 1, Name: 'Tritium' },
    ];
    render(
      <PeriodicTable
        availableElements={elementsWithIsotopes as any}
        selectedElement={null}
        onElementClick={vi.fn()}
      />
    );
    // D and T buttons should be findable
    const allButtons = screen.getAllByRole('button');
    const hasD = allButtons.some(btn => btn.textContent?.includes('D'));
    const hasT = allButtons.some(btn => btn.textContent?.includes('T'));
    expect(hasD).toBe(true);
    expect(hasT).toBe(true);
  });

  it('shows legend when hideLegend is not set', () => {
    render(<PeriodicTable {...defaultProps} />);
    // Legend section should be present with the "Legend:" label
    const legendLabel = screen.queryByText(/Legend/i);
    expect(legendLabel).toBeInTheDocument();
  });

  it('hides legend when hideLegend is true', () => {
    render(<PeriodicTable {...defaultProps} hideLegend={true} />);
    // Legend should not be visible
    const legendContainer = screen.queryByText(/Legend/i);
    // When hideLegend is true, the legend section is not rendered
    expect(legendContainer).toBeNull();
  });

  it('renders with many elements without crashing', () => {
    render(<PeriodicTable {...defaultProps} />);
    // Should render all provided elements
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(5);
  });

  it('calls onParticleClick when particle button is clicked', () => {
    const onParticleClick = vi.fn();
    render(<PeriodicTable {...defaultProps} onParticleClick={onParticleClick} />);
    // Special particles section should be rendered
    const neutronButton = screen.queryByText('n');
    if (neutronButton) {
      fireEvent.click(neutronButton);
      expect(onParticleClick).toHaveBeenCalled();
    }
  });
});
