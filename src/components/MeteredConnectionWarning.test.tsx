import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import MeteredConnectionWarning from './MeteredConnectionWarning';

describe('MeteredConnectionWarning', () => {
  it('renders warning title', () => {
    render(
      <MeteredConnectionWarning
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        databaseSizeMB={161}
      />
    );
    expect(screen.getByTestId('metered-warning')).toBeInTheDocument();
  });

  it('calls onConfirm when download button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <MeteredConnectionWarning
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        databaseSizeMB={161}
      />
    );
    const downloadBtn = screen.getByText(/download anyway/i);
    fireEvent.click(downloadBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when wait button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <MeteredConnectionWarning
        onConfirm={vi.fn()}
        onCancel={onCancel}
        databaseSizeMB={161}
      />
    );
    const waitBtn = screen.getByText(/wait for wi-?fi/i);
    fireEvent.click(waitBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has fixed overlay positioning', () => {
    const { container } = render(
      <MeteredConnectionWarning
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        databaseSizeMB={161}
      />
    );
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
  });
});
