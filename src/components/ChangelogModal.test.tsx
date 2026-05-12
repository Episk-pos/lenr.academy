import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('remark-github', () => ({ default: () => {} }));

import ChangelogModal from './ChangelogModal';
import type { ReleaseNotes } from '../services/changelog';

const mockRelease: ReleaseNotes = {
  tagName: 'v0.2.0',
  name: 'Version 0.2.0 - Major Update',
  body: '## Changes\n- Added new features\n- Fixed bugs',
  publishedAt: '2026-01-15T12:00:00Z',
  htmlUrl: 'https://github.com/Episk-pos/lenr.academy/releases/v0.2.0',
};

describe('ChangelogModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not open', () => {
    const { container } = render(
      <ChangelogModal
        isOpen={false}
        onClose={vi.fn()}
        releaseNotes={null}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); }); // requestAnimationFrame
    expect(screen.getByTestId('changelog-modal')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={null}
        isLoading={true}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    const loadingText = en.updates.whatsNewLoading;
    expect(screen.getByText(loadingText)).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    const onRetry = vi.fn();
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={null}
        isLoading={false}
        error="Failed to load changelog"
        onRetry={onRetry}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    expect(screen.getByText('Failed to load changelog')).toBeInTheDocument();
    fireEvent.click(screen.getByText(en.updates.tryAgain));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders release notes content', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    expect(screen.getByTestId('markdown')).toHaveTextContent('## Changes');
  });

  it('shows release name when different from tag', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    expect(screen.getByText('Version 0.2.0 - Major Update')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <ChangelogModal
        isOpen={true}
        onClose={onClose}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    // There are two close buttons - one X at top, one text button at bottom
    const closeButtons = screen.getAllByText(en.common.close);
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <ChangelogModal
        isOpen={true}
        onClose={onClose}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows GitHub link when htmlUrl is available', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    const link = screen.getByText(en.updates.viewOnGitHub);
    expect(link).toHaveAttribute('href', mockRelease.htmlUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('has dialog role and aria-modal', () => {
    render(
      <ChangelogModal
        isOpen={true}
        onClose={vi.fn()}
        releaseNotes={mockRelease}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        versionLabel="v0.2.0"
      />
    );
    act(() => { vi.advanceTimersByTime(16); });
    const dialog = screen.getByTestId('changelog-modal');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
