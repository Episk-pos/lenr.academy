import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import ColumnToggle from './ColumnToggle';

const columns = [
  { key: 'name', label: 'Name', render: () => null },
  { key: 'symbol', label: 'Symbol', render: () => null },
  { key: 'mass', label: 'Mass', render: () => null },
];

describe('ColumnToggle', () => {
  it('renders the toggle button', () => {
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={false}
      />,
    );
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('opens dropdown on button click', () => {
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Mass')).toBeInTheDocument();
  });

  it('shows checkboxes reflecting column visibility', () => {
    const isVisible = (key: string) => key !== 'mass';
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={isVisible}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={true}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // Name
    expect(checkboxes[1]).toBeChecked(); // Symbol
    expect(checkboxes[2]).not.toBeChecked(); // Mass
  });

  it('calls toggleColumn when checkbox is clicked', () => {
    const toggleColumn = vi.fn();
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={toggleColumn}
        resetColumns={vi.fn()}
        hasCustomization={false}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Symbol
    expect(toggleColumn).toHaveBeenCalledWith('symbol');
  });

  it('shows Reset button when hasCustomization is true', () => {
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={true}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTitle(/Reset/i)).toBeInTheDocument();
  });

  it('hides Reset button when hasCustomization is false', () => {
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={false}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTitle(/Reset/i)).not.toBeInTheDocument();
  });

  it('calls resetColumns when Reset is clicked', () => {
    const resetColumns = vi.fn();
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={resetColumns}
        hasCustomization={true}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByTitle(/Reset/i));
    expect(resetColumns).toHaveBeenCalled();
  });

  it('closes dropdown on Escape key', () => {
    render(
      <ColumnToggle
        allColumns={columns}
        isColumnVisible={() => true}
        toggleColumn={vi.fn()}
        resetColumns={vi.fn()}
        hasCustomization={false}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Name')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });
});
