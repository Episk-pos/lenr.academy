import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Scale: () => <svg data-testid="scale-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
  Percent: () => <svg data-testid="percent-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
  Info: () => <svg data-testid="info-icon" />,
}));

const mockValidateProportions = vi.fn(() => ({ isValid: true, errors: [] as Array<{ nuclideId?: string; message: string }> }));
const mockNormalizeProportions = vi.fn((inputs: Array<{ nuclideId: string; value: number }>) =>
  inputs.map((i) => ({ nuclideId: i.nuclideId, proportion: i.value, sourceType: 'manual' as const }))
);
const mockGetNaturalAbundances = vi.fn(() => [
  { nuclideId: 'Li-6', proportion: 7.59, sourceType: 'natural' as const },
  { nuclideId: 'Li-7', proportion: 92.41, sourceType: 'natural' as const },
]);
const mockCreateEqualProportions = vi.fn((ids: string[]) =>
  ids.map((id) => ({ nuclideId: id, proportion: 100 / ids.length, sourceType: 'manual' as const }))
);
const mockFormatProportion = vi.fn((val: number) => `${val.toFixed(1)}%`);
const mockGetFormatLabel = vi.fn((fmt: string) => fmt === 'percentage' ? 'Percentage' : fmt);
const mockGetFormatHelpText = vi.fn(() => 'Help text for proportions');

vi.mock('../services/proportionService', () => ({
  validateProportions: (...args: Parameters<typeof mockValidateProportions>) => mockValidateProportions(...args),
  normalizeProportions: (...args: Parameters<typeof mockNormalizeProportions>) => mockNormalizeProportions(...args),
  getNaturalAbundances: (...args: Parameters<typeof mockGetNaturalAbundances>) => mockGetNaturalAbundances(...args),
  createEqualProportions: (...args: Parameters<typeof mockCreateEqualProportions>) => mockCreateEqualProportions(...args),
  formatProportion: (...args: Parameters<typeof mockFormatProportion>) => mockFormatProportion(...args),
  getFormatLabel: (...args: Parameters<typeof mockGetFormatLabel>) => mockGetFormatLabel(...args),
  getFormatHelpText: (...args: Parameters<typeof mockGetFormatHelpText>) => mockGetFormatHelpText(...args),
}));

vi.mock('../services/isotopeService', () => ({
  parseNuclideNotation: vi.fn((id: string) => {
    const match = /^([A-Z][a-z]?)-(\d+)$/.exec(id);
    if (!match) return null;
    return { element: match[1], massNumber: parseInt(match[2]) };
  }),
}));

import ProportionInput from './ProportionInput';

describe('ProportionInput', () => {
  const defaultProps = {
    nuclideIds: ['Li-6', 'Li-7'],
    weightedNuclides: [
      { nuclideId: 'Li-6', proportion: 30, sourceType: 'manual' as const },
      { nuclideId: 'Li-7', proportion: 70, sourceType: 'manual' as const },
    ],
    onProportionsChange: vi.fn(),
    format: 'percentage' as const,
    onFormatChange: vi.fn(),
    db: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no nuclides selected', () => {
    render(<ProportionInput {...defaultProps} nuclideIds={[]} weightedNuclides={[]} />);
    expect(screen.getByText('Select fuel nuclides to configure proportions')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Fuel Proportions')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<ProportionInput {...defaultProps} label="Target Mix" />);
    expect(screen.getByText('Target Mix')).toBeInTheDocument();
  });

  it('renders nuclide labels', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Li-6')).toBeInTheDocument();
    expect(screen.getByText('Li-7')).toBeInTheDocument();
  });

  it('renders input fields for each nuclide', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByTestId('proportion-input-input-Li-6')).toBeInTheDocument();
    expect(screen.getByTestId('proportion-input-input-Li-7')).toBeInTheDocument();
  });

  it('shows Equal button', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Equal')).toBeInTheDocument();
  });

  it('calls createEqualProportions when Equal clicked', () => {
    render(<ProportionInput {...defaultProps} />);
    fireEvent.click(screen.getByText('Equal'));
    expect(mockCreateEqualProportions).toHaveBeenCalledWith(['Li-6', 'Li-7'], 'manual');
  });

  it('shows Natural button', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Natural')).toBeInTheDocument();
  });

  it('Natural button is disabled when db is null', () => {
    render(<ProportionInput {...defaultProps} db={null} />);
    const naturalBtn = screen.getByTestId('proportion-input-natural-abundance');
    expect(naturalBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows Normalize button', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Normalize')).toBeInTheDocument();
  });

  it('shows format selector by default', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByTestId('proportion-input-format-selector')).toBeInTheDocument();
  });

  it('hides format selector when showFormatSelector=false', () => {
    render(<ProportionInput {...defaultProps} showFormatSelector={false} />);
    expect(screen.queryByTestId('proportion-input-format-selector')).toBeNull();
  });

  it('shows Total line', () => {
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Total:')).toBeInTheDocument();
  });

  it('handles input change', () => {
    render(<ProportionInput {...defaultProps} />);
    const input = screen.getByTestId('proportion-input-input-Li-6');
    fireEvent.change(input, { target: { value: '50' } });
    // The input value should be updated
    expect((input as HTMLInputElement).value).toBe('50');
  });

  it('shows validation errors when invalid', () => {
    mockValidateProportions.mockReturnValue({
      isValid: false,
      errors: [{ nuclideId: 'Li-6', message: 'Value too high' }],
    });
    render(<ProportionInput {...defaultProps} />);
    expect(screen.getByText('Value too high')).toBeInTheDocument();
  });

  it('uses custom testId', () => {
    render(<ProportionInput {...defaultProps} testId="my-proportions" />);
    expect(screen.getByTestId('my-proportions')).toBeInTheDocument();
  });
});
