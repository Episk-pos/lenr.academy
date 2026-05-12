import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPanel from './FilterPanel';
import type { FilterConfig, FilterPreset } from './FilterPanel';

// Mock PeriodicTableSelector and BadgeSelector
vi.mock('./PeriodicTableSelector', () => ({
  default: ({ label }: { label: string }) => <div data-testid="periodic-selector">{label}</div>,
}));

vi.mock('./BadgeSelector', () => ({
  default: ({ label }: { label: string }) => <div data-testid="badge-selector">{label}</div>,
}));

const baseProps = {
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  searchTerm: '',
  onSearchChange: vi.fn(),
  onExport: vi.fn(),
  exportDisabled: false,
  filters: {},
  filterConfigs: [] as FilterConfig[],
  onFilterChange: vi.fn(),
  onClearAll: vi.fn(),
};

describe('FilterPanel', () => {
  it('renders filter header', () => {
    render(<FilterPanel {...baseProps} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<FilterPanel {...baseProps} searchPlaceholder="Search reactions..." />);
    expect(screen.getByPlaceholderText('Search reactions...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', () => {
    const onSearchChange = vi.fn();
    render(<FilterPanel {...baseProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows clear search button when search has value', () => {
    const onSearchChange = vi.fn();
    render(<FilterPanel {...baseProps} searchTerm="hello" onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByTitle('Clear search'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('renders export button', () => {
    render(<FilterPanel {...baseProps} />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('disables export when exportDisabled', () => {
    render(<FilterPanel {...baseProps} exportDisabled={true} />);
    expect(screen.getByText('Export CSV').closest('button')).toBeDisabled();
  });

  it('calls onExport when export clicked', () => {
    const onExport = vi.fn();
    render(<FilterPanel {...baseProps} onExport={onExport} />);
    fireEvent.click(screen.getByText('Export CSV'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('shows data count when provided', () => {
    render(<FilterPanel {...baseProps} dataCount={50} totalCount={1000} />);
    expect(screen.getByText(/Showing 50 of 1,000 records/)).toBeInTheDocument();
  });

  it('calls onToggleCollapsed when collapse button clicked', () => {
    const onToggleCollapsed = vi.fn();
    render(<FilterPanel {...baseProps} onToggleCollapsed={onToggleCollapsed} />);
    fireEvent.click(screen.getByTitle('Collapse filters'));
    expect(onToggleCollapsed).toHaveBeenCalledOnce();
  });

  it('shows expand button when collapsed', () => {
    render(<FilterPanel {...baseProps} collapsed={true} />);
    expect(screen.getByTitle('Expand filters')).toBeInTheDocument();
  });

  it('shows active filter count badge', () => {
    render(<FilterPanel {...baseProps} filters={{ energy: 5, type: 'fusion' }} filterConfigs={[
      { key: 'energy', label: 'Energy', type: 'range' },
      { key: 'type', label: 'Type', type: 'select' },
    ]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders select filter', () => {
    const configs: FilterConfig[] = [{
      key: 'type',
      label: 'Reaction Type',
      type: 'select',
      options: [
        { value: 'fusion', label: 'Fusion' },
        { value: 'fission', label: 'Fission' },
      ],
    }];
    render(<FilterPanel {...baseProps} filterConfigs={configs} />);
    expect(screen.getByLabelText('Reaction Type')).toBeInTheDocument();
    expect(screen.getByText('Fusion')).toBeInTheDocument();
    expect(screen.getByText('Fission')).toBeInTheDocument();
  });

  it('renders range filter', () => {
    const configs: FilterConfig[] = [{
      key: 'energy',
      label: 'Energy (MeV)',
      type: 'range',
      min: 0,
      max: 100,
    }];
    render(<FilterPanel {...baseProps} filterConfigs={configs} />);
    expect(screen.getByLabelText('Energy (MeV)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Max')).toBeInTheDocument();
  });

  it('renders toggle filter', () => {
    const onFilterChange = vi.fn();
    const configs: FilterConfig[] = [{
      key: 'showRadioactive',
      label: 'Show Radioactive',
      type: 'toggle',
    }];
    render(<FilterPanel {...baseProps} filterConfigs={configs} onFilterChange={onFilterChange} />);
    const checkbox = screen.getByLabelText('Show Radioactive');
    fireEvent.click(checkbox);
    expect(onFilterChange).toHaveBeenCalledWith('showRadioactive', true);
  });

  it('shows Clear All button when filters are active', () => {
    const onClearAll = vi.fn();
    render(<FilterPanel {...baseProps} filters={{ type: 'fusion' }} filterConfigs={[
      { key: 'type', label: 'Type', type: 'select' },
    ]} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText('Clear All'));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('renders presets dropdown with active preset label', () => {
    const presets: FilterPreset[] = [
      { id: 'default', label: 'Default View', filters: {} },
      { id: 'high-energy', label: 'High Energy', filters: { minEnergy: 10 } },
    ];
    render(<FilterPanel {...baseProps} presets={presets} />);
    // Empty filters match the 'default' preset, so the button shows its label
    expect(screen.getByText('Default View')).toBeInTheDocument();
  });

  it('applies preset when selected', () => {
    const onApplyPreset = vi.fn();
    const presets: FilterPreset[] = [
      { id: 'high-energy', label: 'High Energy', filters: { minEnergy: 10 } },
    ];
    render(<FilterPanel {...baseProps} presets={presets} onApplyPreset={onApplyPreset} />);
    // Open dropdown
    fireEvent.click(screen.getByText('Load Preset...'));
    fireEvent.click(screen.getByText('High Energy'));
    expect(onApplyPreset).toHaveBeenCalledWith({ minEnergy: 10 });
  });

  it('shows Save Preset button when filters are active and custom save is available', () => {
    render(<FilterPanel {...baseProps} filters={{ type: 'fusion' }} filterConfigs={[
      { key: 'type', label: 'Type', type: 'select' },
    ]} onSavePreset={vi.fn()} />);
    expect(screen.getByText('Save Preset...')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    const { container } = render(<FilterPanel {...baseProps} className="custom-filter" />);
    expect(container.querySelector('.custom-filter')).toBeInTheDocument();
  });
});
