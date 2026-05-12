import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" className={props.className as string} />,
  XCircle: () => <svg data-testid="xcircle-icon" />,
}));

import CascadeProgressCard from './CascadeProgressCard';

describe('CascadeProgressCard', () => {
  const baseProgress = {
    loop: 3,
    totalLoops: 10,
    newReactionsCount: 5,
    percentage: 40,
  };

  it('renders running simulation title', () => {
    render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    expect(screen.getByText('Running Cascade Simulation...')).toBeInTheDocument();
  });

  it('shows loop progress', () => {
    render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
  });

  it('shows new reactions count when >= 0', () => {
    render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('New Reactions (this loop)')).toBeInTheDocument();
  });

  it('shows finalizing status when newReactionsCount is -1', () => {
    const progress = { ...baseProgress, newReactionsCount: -1 };
    render(<CascadeProgressCard progress={progress} onCancel={vi.fn()} />);
    expect(screen.getByText('Finalizing...')).toBeInTheDocument();
    expect(screen.getByText('Starting finalization process...')).toBeInTheDocument();
  });

  it('shows calculating energy status when newReactionsCount is -2', () => {
    const progress = { ...baseProgress, newReactionsCount: -2 };
    render(<CascadeProgressCard progress={progress} onCancel={vi.fn()} />);
    expect(screen.getByText('Calculating energy...')).toBeInTheDocument();
    expect(screen.getByText('Computing total energy from all reactions...')).toBeInTheDocument();
  });

  it('shows preparing results status when newReactionsCount is -3', () => {
    const progress = { ...baseProgress, newReactionsCount: -3 };
    render(<CascadeProgressCard progress={progress} onCancel={vi.fn()} />);
    expect(screen.getByText('Preparing results...')).toBeInTheDocument();
    expect(screen.getByText('Serializing results for display...')).toBeInTheDocument();
  });

  it('shows percentage complete', () => {
    render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    expect(screen.getByText('40% complete')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<CascadeProgressCard progress={baseProgress} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows searching reactions info text for normal progress', () => {
    render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    expect(screen.getByText('Searching for reactions between active nuclides and products...')).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    const { container } = render(<CascadeProgressCard progress={baseProgress} onCancel={vi.fn()} />);
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeInTheDocument();
    expect((progressBar as HTMLElement).style.width).toBe('40%');
  });

  it('clamps progress bar width to 100%', () => {
    const progress = { ...baseProgress, percentage: 150 };
    const { container } = render(<CascadeProgressCard progress={progress} onCancel={vi.fn()} />);
    const progressBar = container.querySelector('[style*="width"]');
    expect((progressBar as HTMLElement).style.width).toBe('100%');
  });
});
