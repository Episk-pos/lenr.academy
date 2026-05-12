import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BadgeSelector from './BadgeSelector';
import type { BadgeOption } from './BadgeSelector';

const options: BadgeOption[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
];

describe('BadgeSelector', () => {
  it('renders label and all options', () => {
    render(
      <BadgeSelector
        label="Decay Mode"
        options={options}
        selectedValues={[]}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Decay Mode')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows selected count badge', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha', 'beta']}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onSelectionChange to add value when badge is clicked', () => {
    const onChange = vi.fn();
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha']}
        onSelectionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta']);
  });

  it('calls onSelectionChange to remove value when selected badge is clicked', () => {
    const onChange = vi.fn();
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha', 'beta']}
        onSelectionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('Select All selects all options', () => {
    const onChange = vi.fn();
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha']}
        onSelectionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Select All'));
    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta', 'gamma']);
  });

  it('hides Select All when all are selected', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha', 'beta', 'gamma']}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Select All')).not.toBeInTheDocument();
  });

  it('Clear clears all selections', () => {
    const onChange = vi.fn();
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha', 'beta']}
        onSelectionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Clear'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('hides Clear when none are selected', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={[]}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('sets aria-pressed on selected badges', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha']}
        onSelectionChange={vi.fn()}
      />,
    );
    const alpha = screen.getByText('Alpha').closest('button');
    const beta = screen.getByText('Beta').closest('button');
    expect(alpha).toHaveAttribute('aria-pressed', 'true');
    expect(beta).toHaveAttribute('aria-pressed', 'false');
  });

  it('collapses when collapsible and defaultCollapsed', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={[]}
        onSelectionChange={vi.fn()}
        collapsible
        defaultCollapsed
      />,
    );
    // Badges should not be visible
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    // Summary text should be visible
    expect(screen.getByText('All types shown')).toBeInTheDocument();
  });

  it('shows selected summary when collapsed with selections', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha', 'beta']}
        onSelectionChange={vi.fn()}
        collapsible
        defaultCollapsed
      />,
    );
    expect(screen.getByText('2 types selected')).toBeInTheDocument();
  });

  it('shows singular form for 1 type selected', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={['alpha']}
        onSelectionChange={vi.fn()}
        collapsible
        defaultCollapsed
      />,
    );
    expect(screen.getByText('1 type selected')).toBeInTheDocument();
  });

  it('toggles collapse on expand/collapse button click', () => {
    render(
      <BadgeSelector
        label="Mode"
        options={options}
        selectedValues={[]}
        onSelectionChange={vi.fn()}
        collapsible
        defaultCollapsed
      />,
    );
    // Initially collapsed - badges hidden
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    // Click expand
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    // Click collapse
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });
});
