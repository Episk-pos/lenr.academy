import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <svg data-testid="chevron-down" />,
}));

import LimitSelector from './LimitSelector';

describe('LimitSelector', () => {
  it('renders with label', () => {
    render(<LimitSelector value={100} onChange={vi.fn()} />);
    expect(screen.getByText('Result Limit')).toBeInTheDocument();
  });

  it('displays "All" when value is null', () => {
    render(<LimitSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('displays "All" when value is undefined', () => {
    render(<LimitSelector value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('displays numeric value', () => {
    render(<LimitSelector value={500} onChange={vi.fn()} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<LimitSelector value={100} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    expect(screen.getByTestId('limit-option-100')).toBeInTheDocument();
    expect(screen.getByTestId('limit-option-500')).toBeInTheDocument();
    expect(screen.getByTestId('limit-option-1000')).toBeInTheDocument();
    expect(screen.getByTestId('limit-option-5000')).toBeInTheDocument();
  });

  it('calls onChange when option selected', () => {
    const onChange = vi.fn();
    render(<LimitSelector value={100} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    fireEvent.click(screen.getByTestId('limit-option-500'));
    expect(onChange).toHaveBeenCalledWith(500);
  });

  it('calls onChange with undefined for Unlimited', () => {
    const onChange = vi.fn();
    render(<LimitSelector value={100} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    fireEvent.click(screen.getByText('Unlimited ⚠️'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows custom input when Custom selected', () => {
    render(<LimitSelector value={100} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    fireEvent.click(screen.getByTestId('limit-option-custom'));
    expect(screen.getByPlaceholderText('Enter custom limit')).toBeInTheDocument();
  });

  it('submits custom value on OK click', () => {
    const onChange = vi.fn();
    render(<LimitSelector value={100} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    fireEvent.click(screen.getByTestId('limit-option-custom'));
    fireEvent.change(screen.getByPlaceholderText('Enter custom limit'), { target: { value: '250' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).toHaveBeenCalledWith(250);
  });

  it('cancels custom input on Cancel click', () => {
    render(<LimitSelector value={100} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('limit-selector-button'));
    fireEvent.click(screen.getByTestId('limit-option-custom'));
    expect(screen.getByPlaceholderText('Enter custom limit')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByTestId('limit-selector-button')).toBeInTheDocument();
  });

  it('shows recommended text', () => {
    render(<LimitSelector value={100} onChange={vi.fn()} />);
    expect(screen.getByText('Recommended ≤ 5000')).toBeInTheDocument();
  });

  it('displays custom non-preset values', () => {
    render(<LimitSelector value={250} onChange={vi.fn()} />);
    expect(screen.getByText('250')).toBeInTheDocument();
  });
});
