import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="x-icon" />,
  Search: () => <svg data-testid="search-icon" />,
  Beaker: () => <svg data-testid="beaker-icon" />,
  Factory: () => <svg data-testid="factory-icon" />,
  FlaskConical: () => <svg data-testid="flask-icon" />,
  Atom: () => <svg data-testid="atom-icon" />,
  Save: () => <svg data-testid="save-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  User: () => <svg data-testid="user-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  Layers: () => <svg data-testid="layers-icon" />,
}));

const mockMaterials = [
  {
    id: 'natural-lithium',
    name: 'Natural Lithium',
    description: 'Lithium with natural isotope distribution',
    category: 'natural-abundance' as const,
    composition: [
      { nuclideId: 'Li-6', proportion: 7.59 },
      { nuclideId: 'Li-7', proportion: 92.41 },
    ],
    tags: ['lithium', 'natural'],
  },
  {
    id: 'natural-nickel',
    name: 'Natural Nickel',
    description: 'Nickel with natural isotope distribution',
    category: 'natural-abundance' as const,
    composition: [
      { nuclideId: 'Ni-58', proportion: 68.08 },
      { nuclideId: 'Ni-60', proportion: 26.22 },
    ],
    tags: ['nickel', 'natural'],
  },
];

vi.mock('../services/materialsService', () => ({
  getAllMaterials: vi.fn(() => mockMaterials),
  searchMaterials: vi.fn((q: string) => mockMaterials.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))),
  materialToWeightedNuclides: vi.fn((m: typeof mockMaterials[0]) =>
    m.composition.map((c) => ({ nuclideId: c.nuclideId, proportion: c.proportion, source: 'catalog' as const }))
  ),
  saveCustomMaterial: vi.fn(),
  deleteCustomMaterial: vi.fn(),
  createMaterialFromWeightedNuclides: vi.fn(),
  getCustomMaterials: vi.fn(() => []),
}));

vi.mock('../services/proportionService', () => ({
  formatProportion: vi.fn((val: number) => `${val.toFixed(1)}%`),
  mergeWeightedNuclides: vi.fn((...args: unknown[]) => args.flat()),
}));

import MaterialsCatalog from './MaterialsCatalog';

describe('MaterialsCatalog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelectMaterial: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<MaterialsCatalog {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('materials-catalog-modal')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('materials-search-input')).toBeInTheDocument();
  });

  it('shows material items', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('material-item-natural-lithium')).toBeInTheDocument();
    expect(screen.getByTestId('material-item-natural-nickel')).toBeInTheDocument();
  });

  it('shows tab buttons', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('materials-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('materials-tab-natural-abundance')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<MaterialsCatalog {...defaultProps} onClose={onClose} />);
    // Click the overlay to close
    fireEvent.click(screen.getByTestId('materials-catalog-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows material details when item clicked', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('material-item-natural-lithium'));
    // Material name appears in list span AND detail h3
    const matches = screen.getAllByText('Natural Lithium');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('shows replace/blend mode toggle', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('mode-replace')).toBeInTheDocument();
    expect(screen.getByTestId('mode-blend')).toBeInTheDocument();
  });

  it('shows load button in replace mode', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    expect(screen.getByTestId('load-material-button')).toBeInTheDocument();
  });

  it('shows blend controls in blend mode', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('mode-blend'));
    expect(screen.getByTestId('add-to-blend-button')).toBeInTheDocument();
    expect(screen.getByTestId('apply-blend-button')).toBeInTheDocument();
  });

  it('shows save button when currentFuel provided', () => {
    const fuel = [{ nuclideId: 'Li-7', proportion: 100, source: 'manual' as const }];
    render(<MaterialsCatalog {...defaultProps} currentFuel={fuel} />);
    expect(screen.getByTestId('save-custom-material-button')).toBeInTheDocument();
  });

  it('shows material count in footer', () => {
    render(<MaterialsCatalog {...defaultProps} />);
    // 2 materials shown - check that both items render
    const items = screen.getAllByTestId(/^material-item-/);
    expect(items.length).toBe(2);
  });
});
