import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DatabaseLoadingCard from './DatabaseLoadingCard';

describe('DatabaseLoadingCard', () => {
  it('shows initializing text when no download progress', () => {
    render(<DatabaseLoadingCard downloadProgress={null} />);
    expect(screen.getByTestId('database-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading Database')).toBeInTheDocument();
    expect(screen.getByText(/initializing database engine/i)).toBeInTheDocument();
  });

  it('shows "Please wait" message when no progress', () => {
    render(<DatabaseLoadingCard downloadProgress={null} />);
    expect(screen.getByText(/please wait a moment/i)).toBeInTheDocument();
  });

  it('shows downloading text when progress provided', () => {
    render(
      <DatabaseLoadingCard
        downloadProgress={{
          downloadedBytes: 50 * 1024 * 1024,
          totalBytes: 161 * 1024 * 1024,
          percentage: 31,
        }}
      />
    );
    expect(screen.getByText('Downloading Database')).toBeInTheDocument();
    expect(screen.getByText(/downloading parkhomov/i)).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    render(
      <DatabaseLoadingCard
        downloadProgress={{
          downloadedBytes: 80.5 * 1024 * 1024,
          totalBytes: 161 * 1024 * 1024,
          percentage: 50,
        }}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows downloaded/total bytes in MB', () => {
    render(
      <DatabaseLoadingCard
        downloadProgress={{
          downloadedBytes: 80.5 * 1024 * 1024,
          totalBytes: 161 * 1024 * 1024,
          percentage: 50,
        }}
      />
    );
    expect(screen.getByText(/80\.5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/161\.0 MB/)).toBeInTheDocument();
  });

  it('shows caching info text', () => {
    render(
      <DatabaseLoadingCard
        downloadProgress={{
          downloadedBytes: 10 * 1024 * 1024,
          totalBytes: 161 * 1024 * 1024,
          percentage: 6,
        }}
      />
    );
    expect(screen.getByText(/cached for instant loading/i)).toBeInTheDocument();
  });

  it('does not show progress bar when totalBytes is 0', () => {
    render(
      <DatabaseLoadingCard
        downloadProgress={{
          downloadedBytes: 0,
          totalBytes: 0,
          percentage: 0,
        }}
      />
    );
    // Should show downloading text but no progress bar
    expect(screen.getByText('Downloading Database')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});
