import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children without tooltip wrapper when no content', () => {
    render(<Tooltip>Hello</Tooltip>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    // No cursor-help wrapper
    expect(screen.getByText('Hello').closest('.cursor-help')).toBeNull();
  });

  it('renders children with cursor-help wrapper when content provided', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me');
    expect(trigger.closest('.cursor-help')).toBeInTheDocument();
  });

  it('does not show tooltip content initially', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    expect(screen.queryByText('Tip text')).not.toBeInTheDocument();
  });

  it('shows tooltip on click', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.click(trigger);
    expect(screen.getByText('Tip text')).toBeInTheDocument();
  });

  it('hides tooltip on second click (toggle)', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.click(trigger);
    expect(screen.getByText('Tip text')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByText('Tip text')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter after delay', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.mouseEnter(trigger);
    // Not shown immediately
    expect(screen.queryByText('Tip text')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Tip text')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave after delay', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Tip text')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.queryByText('Tip text')).not.toBeInTheDocument();
  });

  it('renders tooltip as portal in document.body', () => {
    render(<Tooltip content="Tip text">Hover me</Tooltip>);
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.click(trigger);
    const tooltip = screen.getByText('Tip text');
    expect(tooltip.closest('body')).toBe(document.body);
  });

  it('closes tooltip on outside click', () => {
    render(
      <div>
        <Tooltip content="Tip text">Hover me</Tooltip>
        <div data-testid="outside">Outside</div>
      </div>
    );
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.click(trigger);
    expect(screen.getByText('Tip text')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Tip text')).not.toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Tooltip content="Tip" className="custom-class">Child</Tooltip>);
    expect(screen.getByText('Child').closest('.custom-class')).toBeInTheDocument();
  });

  it('renders ReactNode content, not just strings', () => {
    render(
      <Tooltip content={<strong>Bold tip</strong>}>Hover me</Tooltip>
    );
    const trigger = screen.getByText('Hover me').closest('.cursor-help')!;
    fireEvent.click(trigger);
    expect(screen.getByText('Bold tip')).toBeInTheDocument();
    expect(screen.getByText('Bold tip').tagName).toBe('STRONG');
  });
});
