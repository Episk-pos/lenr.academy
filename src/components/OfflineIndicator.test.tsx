import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  WifiOff: () => <svg data-testid="wifi-off-icon" />,
  Wifi: () => <svg data-testid="wifi-icon" />,
}));

import OfflineIndicator from './OfflineIndicator';

describe('OfflineIndicator', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, writable: true });
  });

  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    const { container } = render(<OfflineIndicator />);
    expect(container.innerHTML).toBe('');
  });

  it('shows offline banner when starting offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<OfflineIndicator />);
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('shows full text initially then minimizes after 5 seconds', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<OfflineIndicator />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText("You can still query the database if it's cached locally")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows offline banner on offline event', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    render(<OfflineIndicator />);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
  });

  it('shows reconnected message after being offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    render(<OfflineIndicator />);

    // Go offline first (sets wasOffline = true)
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();

    // Go back online
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('offline-reconnected')).toBeInTheDocument();
    expect(screen.getByText('Connection restored')).toBeInTheDocument();
  });

  it('reconnected message disappears after ~2.8 seconds', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    render(<OfflineIndicator />);

    // Go offline first
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));
    });

    // Go back online
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('offline-reconnected')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2800);
    });

    expect(screen.queryByTestId('offline-reconnected')).toBeNull();
  });

  it('sets CSS variable for banner height when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<OfflineIndicator />);
    const height = document.documentElement.style.getPropertyValue('--offline-banner-height');
    expect(height).toBe('48px');
  });

  it('resets CSS variable when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    render(<OfflineIndicator />);
    const height = document.documentElement.style.getPropertyValue('--offline-banner-height');
    expect(height).toBe('0px');
  });
});
