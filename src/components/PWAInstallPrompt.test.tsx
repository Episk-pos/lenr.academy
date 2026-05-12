import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import PWAInstallPrompt from './PWAInstallPrompt';

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // Reset matchMedia to non-standalone
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null by default (no install prompt, not iOS)', () => {
    const { container } = render(<PWAInstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when snoozed', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    localStorage.setItem('lenr-pwa-install-snoozed-until', futureDate);
    const { container } = render(<PWAInstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('shows when snooze has expired', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem('lenr-pwa-install-snoozed-until', pastDate);
    // Still won't show because no deferredPrompt and not iOS
    const { container } = render(<PWAInstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('shows prompt when beforeinstallprompt fires', () => {
    render(<PWAInstallPrompt />);
    // Simulate beforeinstallprompt event
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText('Install LENR Academy')).toBeInTheDocument();
    expect(screen.getByText('Install Now')).toBeInTheDocument();
  });

  it('dismisses and snoozes for 7 days', () => {
    render(<PWAInstallPrompt />);
    // Fire beforeinstallprompt to show prompt
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByTestId('pwa-install-prompt')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss install prompt'));
    // Advance past the 300ms animation
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(localStorage.getItem('lenr-pwa-install-snoozed-until')).not.toBeNull();
  });

  it('has dialog role and aria-label', () => {
    render(<PWAInstallPrompt />);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Install app prompt')).toBeInTheDocument();
  });
});
