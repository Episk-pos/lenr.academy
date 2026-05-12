import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

const mockStartBackgroundUpdate = vi.fn();
const mockReloadWithNewVersion = vi.fn();

let mockDatabaseState = {
  isUpdateAvailable: false,
  isDownloadingUpdate: false,
  updateReady: false,
  downloadProgress: null as { percentage: number; downloadedBytes: number; totalBytes: number } | null,
  currentVersion: '1.0.0',
  availableVersion: '1.1.0',
  startBackgroundUpdate: mockStartBackgroundUpdate,
  reloadWithNewVersion: mockReloadWithNewVersion,
};

vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => mockDatabaseState,
}));

import DatabaseUpdateBanner from './DatabaseUpdateBanner';

describe('DatabaseUpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDatabaseState = {
      isUpdateAvailable: false,
      isDownloadingUpdate: false,
      updateReady: false,
      downloadProgress: null,
      currentVersion: '1.0.0',
      availableVersion: '1.1.0',
      startBackgroundUpdate: mockStartBackgroundUpdate,
      reloadWithNewVersion: mockReloadWithNewVersion,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no update scenario', () => {
    const { container } = render(<DatabaseUpdateBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows update available banner', () => {
    mockDatabaseState.isUpdateAvailable = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByTestId('database-update-banner')).toBeInTheDocument();
  });

  it('shows download button when update available', () => {
    mockDatabaseState.isUpdateAvailable = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByText(en.updates.downloadUpdate)).toBeInTheDocument();
  });

  it('calls startBackgroundUpdate when download clicked', () => {
    mockDatabaseState.isUpdateAvailable = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    fireEvent.click(screen.getByText(en.updates.downloadUpdate));
    expect(mockStartBackgroundUpdate).toHaveBeenCalled();
  });

  it('shows downloading state', () => {
    mockDatabaseState.isDownloadingUpdate = true;
    mockDatabaseState.downloadProgress = {
      percentage: 50,
      downloadedBytes: 80 * 1024 * 1024,
      totalBytes: 161 * 1024 * 1024,
    };
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByText(en.updates.downloadingUpdate)).toBeInTheDocument();
  });

  it('shows update ready banner with refresh button', () => {
    mockDatabaseState.updateReady = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByText(en.updates.refreshNow)).toBeInTheDocument();
  });

  it('calls reloadWithNewVersion when refresh clicked', () => {
    mockDatabaseState.updateReady = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    fireEvent.click(screen.getByText(en.updates.refreshNow));
    expect(mockReloadWithNewVersion).toHaveBeenCalled();
  });

  it('dismisses when close button clicked', () => {
    mockDatabaseState.isUpdateAvailable = true;
    render(<DatabaseUpdateBanner />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    fireEvent.click(screen.getByLabelText(en.common.close));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // After dismissal + animation, banner should be gone
    expect(screen.queryByTestId('database-update-banner')).toBeNull();
  });

  it('applies className prop', () => {
    mockDatabaseState.isUpdateAvailable = true;
    render(<DatabaseUpdateBanner className="my-class" />);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(screen.getByTestId('database-update-banner').className).toContain('my-class');
  });
});
