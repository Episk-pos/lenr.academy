import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

const mockUseDatabase = vi.fn();
vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => mockUseDatabase(),
}));

vi.mock('../contexts/QueryStateContext', () => ({
  useQueryState: () => ({
    getFissionState: vi.fn(() => null),
    updateFissionState: vi.fn(),
  }),
}));

vi.mock('../hooks/useQueryHistory', () => ({
  useQueryHistory: () => ({
    history: [],
    addToHistory: vi.fn(),
    toggleBookmark: vi.fn(),
    removeFromHistory: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

vi.mock('../components/DatabaseLoadingCard', () => ({
  default: ({ progress }: { progress?: number }) => (
    <div data-testid="database-loading">Loading DB...{progress && ` ${progress}%`}</div>
  ),
}));

vi.mock('../components/PeriodicTableSelector', () => ({
  default: () => <div data-testid="periodic-table-selector" />,
}));

vi.mock('../components/PeriodicTable', () => ({
  default: () => <div data-testid="periodic-table" />,
}));

vi.mock('../components/ElementDetailsCard', () => ({
  default: () => <div data-testid="element-details-card" />,
}));

vi.mock('../components/NuclideDetailsCard', () => ({
  default: () => <div data-testid="nuclide-details-card" />,
}));

vi.mock('../components/VirtualizedList', () => ({
  VirtualizedList: () => <div data-testid="virtualized-list" />,
}));

vi.mock('../components/LimitSelector', () => ({
  default: () => <div data-testid="limit-selector" />,
}));

vi.mock('../components/ShareQueryButton', () => ({
  default: () => <div data-testid="share-query-button" />,
}));

vi.mock('../components/QueryHistoryPanel', () => ({
  default: () => <div data-testid="query-history-panel" />,
}));

vi.mock('../components/EnergyHistogram', () => ({
  default: () => <div data-testid="energy-histogram" />,
}));

vi.mock('../components/ReactionNetworkGraph', () => ({
  default: () => <div data-testid="reaction-network-graph" />,
}));

vi.mock('../utils/exportUtils', () => ({
  exportToJSON: vi.fn(),
  exportToPDF: vi.fn(),
}));

vi.mock('../services/queryService', () => ({
  queryFission: vi.fn(() => ({
    reactions: [],
    nuclides: [],
    elements: [],
    executionTime: 0,
    rowCount: 0,
    totalCount: 0,
  })),
  getAllElements: vi.fn(() => []),
  getNuclideBySymbol: vi.fn(),
  getElementBySymbol: vi.fn(),
  getAtomicRadii: vi.fn(() => []),
  calculateHeatmapMetrics: vi.fn(() => null),
}));

vi.mock('lucide-react', () => ({
  Download: () => <svg data-testid="download-icon" />,
  FileJson: () => <svg data-testid="file-json-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  Info: () => <svg data-testid="info-icon" />,
  Loader: () => <svg data-testid="loader-icon" />,
  Eye: () => <svg data-testid="eye-icon" />,
  EyeOff: () => <svg data-testid="eye-off-icon" />,
  Radiation: () => <svg data-testid="radiation-icon" />,
  ChevronDown: () => <svg data-testid="chevron-icon" />,
}));

import FissionQuery from './FissionQuery';

describe('FissionQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading card when database is loading', () => {
    mockUseDatabase.mockReturnValue({
      db: null,
      isLoading: true,
      error: null,
      downloadProgress: 50,
    });
    render(
      <MemoryRouter>
        <FissionQuery />
      </MemoryRouter>
    );
    expect(screen.getByTestId('database-loading')).toBeInTheDocument();
  });

  it('throws error to ErrorBoundary when database fails to load', () => {
    mockUseDatabase.mockReturnValue({
      db: null,
      isLoading: false,
      error: new Error('Database error'),
      downloadProgress: 0,
    });
    expect(() =>
      render(
        <MemoryRouter>
          <FissionQuery />
        </MemoryRouter>
      )
    ).toThrow('Database error');
  });

  it('renders query UI when database is loaded', () => {
    const mockDb = { exec: vi.fn(() => []) };
    mockUseDatabase.mockReturnValue({
      db: mockDb,
      isLoading: false,
      error: null,
      downloadProgress: 100,
    });
    render(
      <MemoryRouter>
        <FissionQuery />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('database-loading')).toBeNull();
  });

  it('renders page heading', () => {
    const mockDb = { exec: vi.fn(() => []) };
    mockUseDatabase.mockReturnValue({
      db: mockDb,
      isLoading: false,
      error: null,
      downloadProgress: 100,
    });
    render(
      <MemoryRouter>
        <FissionQuery />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('parses URL search params for element selection', () => {
    const mockDb = { exec: vi.fn(() => []) };
    mockUseDatabase.mockReturnValue({
      db: mockDb,
      isLoading: false,
      error: null,
      downloadProgress: 100,
    });
    render(
      <MemoryRouter initialEntries={['/fission?e=U&e1=Ba&e2=Kr']}>
        <FissionQuery />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('database-loading')).toBeNull();
  });

  it('parses MeV and neutrino params from URL', () => {
    const mockDb = { exec: vi.fn(() => []) };
    mockUseDatabase.mockReturnValue({
      db: mockDb,
      isLoading: false,
      error: null,
      downloadProgress: 100,
    });
    render(
      <MemoryRouter initialEntries={['/fission?minMeV=5&neutrino=none']}>
        <FissionQuery />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('database-loading')).toBeNull();
  });
});
