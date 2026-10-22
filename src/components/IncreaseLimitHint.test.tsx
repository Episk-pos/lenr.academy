import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import IncreaseLimitHint from './IncreaseLimitHint';

afterEach(() => {
  vi.useRealTimers();
});

describe('IncreaseLimitHint', () => {
  it('renders an actionable button', () => {
    render(<IncreaseLimitHint onExpand={vi.fn()} targetId="limit" />);
    expect(screen.getByRole('button', { name: 'Increase limit to see more results' })).toBeInTheDocument();
  });

  it('expands the filters and focuses/scrolls to the target control', () => {
    vi.useFakeTimers();
    const onExpand = vi.fn();
    render(
      <div>
        <IncreaseLimitHint onExpand={onExpand} targetId="limit" />
        <button id="limit">limit</button>
      </div>,
    );
    const target = screen.getByRole('button', { name: 'limit' });
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByTestId('increase-limit-button'));
    expect(onExpand).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runAllTimers();
    });
    expect(scrollIntoView).toHaveBeenCalled();
    expect(target).toHaveFocus();
  });

  it('does not throw when the target is missing', () => {
    vi.useFakeTimers();
    const onExpand = vi.fn();
    render(<IncreaseLimitHint onExpand={onExpand} targetId="missing" />);
    fireEvent.click(screen.getByTestId('increase-limit-button'));
    expect(() => act(() => { vi.runAllTimers(); })).not.toThrow();
    expect(onExpand).toHaveBeenCalled();
  });
});
