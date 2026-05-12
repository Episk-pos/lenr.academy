import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

// Mock child components
vi.mock('./CascadeSankeyDiagram', () => ({
  default: () => <div data-testid="sankey-diagram" />,
}));

vi.mock('./PathwayBrowserTable', () => ({
  default: () => <div data-testid="pathway-table" />,
}));

vi.mock('./CascadeNetworkDiagram', () => ({
  default: () => <div data-testid="network-diagram" />,
}));

import CascadeTabs from './CascadeTabs';
import type { CascadeResults } from '../types';

const mockResults: CascadeResults = {
  reactions: [
    {
      type: 'fusion',
      inputs: ['H-1', 'Li-7'],
      outputs: ['He-4', 'He-4'],
      MeV: 17.3,
      loop: 0,
      neutrino: 'none',
    },
    {
      type: 'fusion',
      inputs: ['H-1', 'Li-7'],
      outputs: ['He-4', 'He-4'],
      MeV: 17.3,
      loop: 1,
      neutrino: 'none',
    },
  ],
  productDistribution: new Map([['He-4', 4], ['Li-7', 1]]),
  nuclides: [],
  elements: [],
  totalEnergy: 34.6,
  loopsExecuted: 2,
  executionTime: 10,
  terminationReason: 'max_loops',
};

describe('CascadeTabs', () => {
  it('renders all tab buttons', () => {
    render(<CascadeTabs results={mockResults} />);
    expect(screen.getByText(en.cascades.tabSummary)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.tabFlowView)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.tabPathwayBrowser)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.tabNetwork)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.tabProducts)).toBeInTheDocument();
  });

  it('shows summary tab by default', () => {
    render(<CascadeTabs results={mockResults} />);
    expect(screen.getByText(en.cascades.uniquePathways)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.totalReactions)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.feedbackLoops)).toBeInTheDocument();
    expect(screen.getByText(en.cascades.avgFrequency)).toBeInTheDocument();
  });

  it('shows tip in summary tab', () => {
    render(<CascadeTabs results={mockResults} />);
    expect(screen.getByText(/Tip/)).toBeInTheDocument();
  });

  it('switches to flow view tab', () => {
    render(<CascadeTabs results={mockResults} />);
    fireEvent.click(screen.getByText(en.cascades.tabFlowView));
    expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
  });

  it('switches to pathway browser tab', () => {
    render(<CascadeTabs results={mockResults} />);
    fireEvent.click(screen.getByText(en.cascades.tabPathwayBrowser));
    expect(screen.getByTestId('pathway-table')).toBeInTheDocument();
  });

  it('switches to network tab', () => {
    render(<CascadeTabs results={mockResults} />);
    fireEvent.click(screen.getByText(en.cascades.tabNetwork));
    expect(screen.getByTestId('network-diagram')).toBeInTheDocument();
  });

  it('switches to products tab', () => {
    render(<CascadeTabs results={mockResults} />);
    fireEvent.click(screen.getByText(en.cascades.tabProducts));
    // Should show product distribution
    expect(screen.getByText('He-4')).toBeInTheDocument();
    expect(screen.getByText('4×')).toBeInTheDocument();
  });

  it('shows product count in products tab', () => {
    render(<CascadeTabs results={mockResults} />);
    fireEvent.click(screen.getByText(en.cascades.tabProducts));
    // Both products listed
    expect(screen.getByText('He-4')).toBeInTheDocument();
    expect(screen.getByText('Li-7')).toBeInTheDocument();
  });
});
