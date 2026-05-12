import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Sentry
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();
const mockStartSpan = vi.fn((_, cb) => cb({ setAttribute: vi.fn() }));

vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  startSpan: (opts: unknown, cb: (span: unknown) => void) => mockStartSpan(opts, cb),
}));

import SentryTest from './SentryTest';

describe('SentryTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(<SentryTest />);
    expect(screen.getByText('Sentry Testing Page')).toBeInTheDocument();
  });

  it('renders all test buttons', () => {
    render(<SentryTest />);
    expect(screen.getByText('Test Error Capture')).toBeInTheDocument();
    expect(screen.getByText('Test Performance Span')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
    expect(screen.getByText('Test Error with Context')).toBeInTheDocument();
    expect(screen.getByText('Clear Results')).toBeInTheDocument();
  });

  it('captures error when Test Error button clicked', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Error Capture'));
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error from Sentry Test page' })
    );
  });

  it('sends message when Test Message button clicked', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Message'));
    expect(mockCaptureMessage).toHaveBeenCalledWith('Test message from Sentry Test page', 'info');
  });

  it('creates performance span when button clicked', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Performance Span'));
    expect(mockStartSpan).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'test.operation', name: 'Sentry Test Button Click' }),
      expect.any(Function)
    );
  });

  it('sends error with context when button clicked', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Error with Context'));
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ test_type: 'manual' }),
        level: 'warning',
      })
    );
  });

  it('shows test results after clicking buttons', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Error Capture'));
    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText(/Error captured and sent to Sentry/)).toBeInTheDocument();
  });

  it('clears results when Clear Results clicked', () => {
    render(<SentryTest />);
    fireEvent.click(screen.getByText('Test Error Capture'));
    expect(screen.getByText('Test Results')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear Results'));
    expect(screen.queryByText('Test Results')).not.toBeInTheDocument();
  });

  it('renders configuration status section', () => {
    render(<SentryTest />);
    expect(screen.getByText('Configuration Status')).toBeInTheDocument();
  });

  it('renders verification instructions', () => {
    render(<SentryTest />);
    expect(screen.getByText('How to Verify')).toBeInTheDocument();
  });
});
