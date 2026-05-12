import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

// Mock ThemeContext
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

// Mock recharts - they don't render in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div />,
}));

import EnergyHistogram from './EnergyHistogram';

const mockReactions = [
  { MeV: 1.5 },
  { MeV: 2.3 },
  { MeV: 0.8 },
  { MeV: -0.5 },
  { MeV: 3.1 },
  { MeV: 1.2 },
  { MeV: 2.7 },
  { MeV: 0.3 },
  { MeV: 4.0 },
  { MeV: 1.8 },
];

describe('EnergyHistogram', () => {
  it('returns null when no reactions', () => {
    const { container } = render(<EnergyHistogram reactions={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    expect(screen.getByText(en.histogram.title)).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    expect(screen.getByText(en.histogram.description)).toBeInTheDocument();
  });

  it('starts collapsed', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    // The chart container should exist but be hidden via max-h-0
    const expandBtn = screen.getByTitle(en.histogram.expand);
    expect(expandBtn).toBeInTheDocument();
  });

  it('expands when toggle button clicked', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    const expandBtn = screen.getByTitle(en.histogram.expand);
    fireEvent.click(expandBtn);
    // After expanding, the collapse button should appear
    expect(screen.getByTitle(en.histogram.collapse)).toBeInTheDocument();
  });

  it('shows statistics when expanded', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    fireEvent.click(screen.getByTitle(en.histogram.expand));
    // Stats should show mean, median, min, max, stddev, count
    expect(screen.getByText(en.histogram.mean)).toBeInTheDocument();
    expect(screen.getByText(en.histogram.median)).toBeInTheDocument();
    expect(screen.getByText(en.histogram.count)).toBeInTheDocument();
  });

  it('shows correct reaction count', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    fireEvent.click(screen.getByTitle(en.histogram.expand));
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders chart components when expanded', () => {
    render(<EnergyHistogram reactions={mockReactions} />);
    fireEvent.click(screen.getByTitle(en.histogram.expand));
    expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('handles single reaction', () => {
    render(<EnergyHistogram reactions={[{ MeV: 5.0 }]} />);
    expect(screen.getByText(en.histogram.title)).toBeInTheDocument();
  });
});
