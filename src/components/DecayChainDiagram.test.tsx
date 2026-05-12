import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DecayChainNode } from '../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: (args: any) => React.ReactNode }) =>
    <div data-testid="transform-wrapper">{children({ zoomIn: vi.fn(), zoomOut: vi.fn(), resetTransform: vi.fn() })}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="transform-component">{children}</div>,
}));

vi.mock('lucide-react', () => ({
  ZoomIn: () => <svg data-testid="zoom-in-icon" />,
  ZoomOut: () => <svg data-testid="zoom-out-icon" />,
  Maximize2: () => <svg data-testid="maximize-icon" />,
}));

import DecayChainDiagram from './DecayChainDiagram';

function makeNode(overrides?: Partial<DecayChainNode>): DecayChainNode {
  return {
    nuclide: { Z: 92, A: 238, E: 'U' },
    isStable: false,
    children: [],
    logHalfLife: 9.15,
    ...overrides,
  } as DecayChainNode;
}

function makeDecayChain(): DecayChainNode {
  return makeNode({
    nuclide: { Z: 92, A: 238, E: 'U' },
    isStable: false,
    logHalfLife: 9.15,
    children: [
      makeNode({
        nuclide: { Z: 90, A: 234, E: 'Th' },
        isStable: false,
        decayMode: 'A',
        branchingRatio: 100,
        halfLife: 24.1,
        halfLifeUnits: 'd',
        children: [
          makeNode({
            nuclide: { Z: 82, A: 206, E: 'Pb' },
            isStable: true,
            decayMode: 'B-',
            branchingRatio: 100,
            children: [],
          }),
        ],
      }),
    ],
  });
}

describe('DecayChainDiagram', () => {
  it('renders SVG with nodes', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByTestId('transform-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('transform-component')).toBeInTheDocument();
  });

  it('renders element symbols for each node', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByText('U-238')).toBeInTheDocument();
    expect(screen.getByText('Th-234')).toBeInTheDocument();
    expect(screen.getByText('Pb-206')).toBeInTheDocument();
  });

  it('shows STABLE label for stable nodes', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByText('STABLE')).toBeInTheDocument();
  });

  it('shows RADIOACTIVE label for radioactive nodes', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    const radioactiveLabels = screen.getAllByText('RADIOACTIVE');
    expect(radioactiveLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders decay mode labels on edges', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B-')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset view')).toBeInTheDocument();
  });

  it('renders legend section with decay modes', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    expect(screen.getByText('Decay Modes')).toBeInTheDocument();
    expect(screen.getByText('Alpha (α)')).toBeInTheDocument();
    expect(screen.getByText('Beta- (β-)')).toBeInTheDocument();
  });

  it('shows empty state when root has no data', () => {
    const emptyRoot = makeNode({ children: [] });
    render(<DecayChainDiagram root={emptyRoot} />);
    // Should still render the single root node
    expect(screen.getByText('U-238')).toBeInTheDocument();
  });

  it('renders with showWrapper=false prop', () => {
    const { container } = render(<DecayChainDiagram root={makeDecayChain()} showWrapper={false} />);
    // The mock always renders the wrapper div; we verify the component accepts the prop without error
    expect(container.querySelector('[data-testid="transform-wrapper"]')).toBeInTheDocument();
  });

  it('renders with minimal styling', () => {
    render(<DecayChainDiagram root={makeDecayChain()} minimal={true} />);
    expect(screen.getByText('Decay Modes')).toBeInTheDocument();
  });

  it('renders half-life information', () => {
    render(<DecayChainDiagram root={makeDecayChain()} />);
    // Th-234 has halfLife=24.1, halfLifeUnits='d' → "24.1 days"
    expect(screen.getByText('24.1 days')).toBeInTheDocument();
    // Pb-206 stable half-life text (case-insensitive, may be "Stable" or appear within SVG)
    const stableTexts = screen.getAllByText(/^Stable$/i);
    expect(stableTexts.length).toBeGreaterThanOrEqual(1);
  });
});
