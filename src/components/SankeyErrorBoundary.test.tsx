import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SankeyErrorBoundary } from './SankeyErrorBoundary';

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Sankey overflow');
  return <div>Child content</div>;
}

describe('SankeyErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    console.error = originalError;
    vi.useRealTimers();
  });

  it('renders children when there is no error', () => {
    render(
      <SankeyErrorBoundary onError={vi.fn()}>
        <ThrowError shouldThrow={false} />
      </SankeyErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('calls onError when child throws', () => {
    const onError = vi.fn();
    render(
      <SankeyErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </SankeyErrorBoundary>
    );
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sankey overflow' }));
  });

  it('renders null when error occurs (handled by parent)', () => {
    const { container } = render(
      <SankeyErrorBoundary onError={vi.fn()}>
        <ThrowError shouldThrow={true} />
      </SankeyErrorBoundary>
    );
    expect(container.innerHTML).toBe('');
  });

  it('schedules a state reset after 100ms', () => {
    const onError = vi.fn();
    render(
      <SankeyErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </SankeyErrorBoundary>
    );
    // Error boundary caught the error and rendered null
    expect(onError).toHaveBeenCalled();
    // The setTimeout for 100ms is scheduled to reset hasError
    // Advance timers to confirm no errors are thrown
    act(() => { vi.advanceTimersByTime(100); });
  });
});
