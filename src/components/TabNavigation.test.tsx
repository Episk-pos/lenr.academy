import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('lucide-react', () => ({
  Menu: () => <svg data-testid="menu-icon" />,
}));

import TabNavigation, { type Tab } from './TabNavigation';

const mockTabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details', count: 42 },
  { id: 'chart', label: 'Chart' },
];

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe('TabNavigation', () => {
  let onTabChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTabChange = vi.fn();
  });

  it('renders all tabs', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Chart')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="details" onTabChange={onTabChange} />
    );
    const detailsTab = screen.getByText('Details').closest('button');
    expect(detailsTab?.getAttribute('aria-selected')).toBe('true');

    const overviewTab = screen.getByText('Overview').closest('button');
    expect(overviewTab?.getAttribute('aria-selected')).toBe('false');
  });

  it('shows count badge on tabs with count', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('calls onTabChange when tab clicked', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    fireEvent.click(screen.getByText('Chart'));
    expect(onTabChange).toHaveBeenCalledWith('chart');
  });

  it('handles keyboard activation with Enter', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    const chartTab = screen.getByText('Chart').closest('button')!;
    fireEvent.keyDown(chartTab, { key: 'Enter' });
    expect(onTabChange).toHaveBeenCalledWith('chart');
  });

  it('handles keyboard activation with Space', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    const chartTab = screen.getByText('Chart').closest('button')!;
    fireEvent.keyDown(chartTab, { key: ' ' });
    expect(onTabChange).toHaveBeenCalledWith('chart');
  });

  it('renders with role=tablist', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} />
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('sets tabIndex 0 on active tab and -1 on others', () => {
    renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="details" onTabChange={onTabChange} />
    );
    const detailsTab = screen.getByText('Details').closest('button');
    expect(detailsTab?.tabIndex).toBe(0);

    const overviewTab = screen.getByText('Overview').closest('button');
    expect(overviewTab?.tabIndex).toBe(-1);
  });

  it('applies custom className', () => {
    const { container } = renderWithRouter(
      <TabNavigation tabs={mockTabs} activeTab="overview" onTabChange={onTabChange} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
