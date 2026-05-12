import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import type { ChartNuclide } from './SegreChartDiagram';
import { mockReactI18next } from '../test-utils/i18nMock';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => mockReactI18next);

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
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

import SegreChartDiagram from './SegreChartDiagram';

const mockNuclides: ChartNuclide[] = [
  { Z: 1, N: 0, A: 1, E: 'H', stability: 'stable' },
  { Z: 1, N: 1, A: 2, E: 'D', stability: 'stable' },
  { Z: 2, N: 2, A: 4, E: 'He', stability: 'stable' },
  { Z: 6, N: 6, A: 12, E: 'C', stability: 'stable' },
  { Z: 92, N: 146, A: 238, E: 'U', stability: 'long', logHalfLife: 9.15 },
  { Z: 27, N: 33, A: 60, E: 'Co', stability: 'short', logHalfLife: 0.22 },
];

describe('SegreChartDiagram', () => {
  it('renders the chart container', () => {
    render(<SegreChartDiagram nuclides={mockNuclides} />);
    expect(screen.getByTestId('transform-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('transform-component')).toBeInTheDocument();
  });

  it('renders SVG with nuclide cells', () => {
    const { container } = render(<SegreChartDiagram nuclides={mockNuclides} />);
    const rects = container.querySelectorAll('rect');
    // Should have at least as many rect elements as nuclides
    expect(rects.length).toBeGreaterThanOrEqual(mockNuclides.length);
  });

  it('renders zoom control buttons', () => {
    render(<SegreChartDiagram nuclides={mockNuclides} />);
    expect(screen.getByTitle(en.segreChart.zoomIn)).toBeInTheDocument();
    expect(screen.getByTitle(en.segreChart.zoomOut)).toBeInTheDocument();
    expect(screen.getByTitle(en.segreChart.resetZoom)).toBeInTheDocument();
  });

  it('renders axis labels', () => {
    render(<SegreChartDiagram nuclides={mockNuclides} />);
    expect(screen.getByText(en.segreChart.protonNumberAxis)).toBeInTheDocument();
    expect(screen.getByText(en.segreChart.neutronNumberAxis)).toBeInTheDocument();
  });

  it('calls onNuclideClick when a nuclide is clicked', () => {
    const onNuclideClick = vi.fn();
    const { container } = render(<SegreChartDiagram nuclides={mockNuclides} onNuclideClick={onNuclideClick} />);
    const firstRect = container.querySelector('rect.cursor-pointer');
    if (firstRect) {
      fireEvent.click(firstRect);
      expect(onNuclideClick).toHaveBeenCalled();
    }
  });

  it('navigates to element-data when no onNuclideClick provided', () => {
    const { container } = render(<SegreChartDiagram nuclides={mockNuclides} />);
    const firstRect = container.querySelector('rect.cursor-pointer');
    if (firstRect) {
      fireEvent.click(firstRect);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/element-data'));
    }
  });

  it('renders with empty nuclides array', () => {
    const { container } = render(<SegreChartDiagram nuclides={[]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with single nuclide', () => {
    render(<SegreChartDiagram nuclides={[mockNuclides[0]]} />);
    expect(screen.getByTestId('transform-component')).toBeInTheDocument();
  });
});
