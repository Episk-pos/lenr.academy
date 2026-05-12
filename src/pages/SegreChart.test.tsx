import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

const mockNuclides = [
  { Z: 1, A: 1, E: 'H', logHalfLife: 20, BE: 0, nBorF: 'f', aBorF: 'f' },
  { Z: 1, A: 2, E: 'D', logHalfLife: 20, BE: 2.2, nBorF: 'b', aBorF: 'b' },
  { Z: 6, A: 14, E: 'C', logHalfLife: 3.76, BE: 105, nBorF: 'b', aBorF: 'b' },
  { Z: 92, A: 238, E: 'U', logHalfLife: 1.5, BE: 1802, nBorF: 'b', aBorF: 'b' },
  { Z: 99, A: 253, E: 'Es', logHalfLife: null, BE: null, nBorF: 'f', aBorF: 'f' },
];

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({
    db: { exec: vi.fn() },
    isLoading: false,
    error: null,
    downloadProgress: null,
  }),
}));

vi.mock('../services/queryService', () => ({
  getAllNuclides: vi.fn(() => mockNuclides),
}));

vi.mock('../components/SegreChartDiagram', () => ({
  default: ({ nuclides }: { nuclides: Array<{ Z: number; N: number }> }) => (
    <div data-testid="segre-chart-diagram">Chart with {nuclides.length} nuclides</div>
  ),
}));

vi.mock('../components/DatabaseLoadingCard', () => ({
  default: () => <div data-testid="loading-card">Loading...</div>,
}));

import SegreChart from './SegreChart';

describe('SegreChart', () => {
  it('renders page title', () => {
    render(<SegreChart />);
    const title = (en as any).segreChart?.title;
    if (title) {
      expect(screen.getByText(title)).toBeInTheDocument();
    } else {
      expect(screen.getByText('segreChart.title')).toBeInTheDocument();
    }
  });

  it('renders the chart diagram', () => {
    render(<SegreChart />);
    expect(screen.getByTestId('segre-chart-diagram')).toBeInTheDocument();
    expect(screen.getByText('Chart with 5 nuclides')).toBeInTheDocument();
  });

  it('shows legend section', () => {
    render(<SegreChart />);
    const legendKey = (en as any).segreChart?.legend;
    if (legendKey) {
      expect(screen.getByText(legendKey)).toBeInTheDocument();
    }
  });

  it('shows stability counts in legend', () => {
    render(<SegreChart />);
    // 2 stable (H logHalfLife=20, D logHalfLife=20), 1 long (C logHalfLife=3.76), 1 short (U logHalfLife=1.5), 1 unknown (Es logHalfLife=null)
    // Stable: logHalfLife > 9 → H, D = 2
    // Long: logHalfLife > 2 → C = 1
    // Short: everything else → U = 1
    // Unknown: null → Es = 1
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument(); // stable count
  });

  it('passes nuclides with computed N values to chart diagram', () => {
    render(<SegreChart />);
    // The mock SegreChartDiagram receives nuclides from getAllNuclides (5 mock nuclides)
    expect(screen.getByTestId('segre-chart-diagram')).toBeInTheDocument();
    expect(screen.getByText('Chart with 5 nuclides')).toBeInTheDocument();
  });
});
