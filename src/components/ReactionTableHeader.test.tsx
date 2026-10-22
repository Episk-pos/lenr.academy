import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ReactionTableHeader from './ReactionTableHeader';

describe('ReactionTableHeader', () => {
  const columns = [
    { key: 'inputs', label: 'Inputs', children: [{ key: 'i1', label: 'Input 1' }, { key: 'i2', label: 'Input 2' }] },
    { key: 'output', label: 'Output' },
    { key: 'energy', label: <>Energy <span className="normal-case">(MeV)</span></> },
    { key: 'neutrino', label: 'Neutrino', compact: true, normalCase: true },
  ];

  it('renders each label exactly once (no duplicated sub-headers)', () => {
    render(<ReactionTableHeader columns={columns} gridTemplateColumns="repeat(5, 1fr)" />);
    expect(screen.getAllByText('Output')).toHaveLength(1);
    expect(screen.getAllByText('Neutrino')).toHaveLength(1);
    expect(screen.getAllByText('Inputs')).toHaveLength(1);
    expect(screen.getByText('Input 1')).toBeInTheDocument();
    expect(screen.getByText('Input 2')).toBeInTheDocument();
  });

  it('places grouped columns over their sub-columns and spans singles across both rows', () => {
    render(<ReactionTableHeader columns={columns} gridTemplateColumns="repeat(5, 1fr)" />);
    const inputs = screen.getByText('Inputs');
    expect(inputs.style.gridColumn).toMatch(/1 \/ span 2/);
    expect(screen.getByText('Input 2').style.gridColumn).toBe('2');
    const output = screen.getByText('Output');
    expect(output.style.gridColumn).toBe('3');
    expect(output.style.gridRow).toMatch(/1 \/ span 2/);
    expect(screen.getByText('Neutrino').style.gridColumn).toBe('5');
  });

  it('keeps unit text and compact columns out of the uppercase transform', () => {
    render(<ReactionTableHeader columns={columns} gridTemplateColumns="repeat(5, 1fr)" />);
    expect(screen.getByText('(MeV)')).toHaveClass('normal-case');
    expect(screen.getByText('Neutrino')).toHaveClass('normal-case');
    expect(screen.getByText('Neutrino')).not.toHaveClass('uppercase');
  });

  it('applies the grid template and dark-mode background', () => {
    render(<ReactionTableHeader columns={columns} gridTemplateColumns="repeat(5, 1fr)" />);
    const header = screen.getByTestId('reaction-table-header');
    expect(header.style.gridTemplateColumns).toBe('repeat(5, 1fr)');
    expect(header.className).toMatch(/dark:bg-gray-800/);
  });
});
