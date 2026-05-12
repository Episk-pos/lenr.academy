import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock analytics
vi.mock('../utils/analytics', () => ({
  loadUmamiScript: vi.fn().mockResolvedValue(undefined),
}));

import PrivacyPreferences from './PrivacyPreferences';

describe('PrivacyPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders page title', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
  });

  it('renders error reporting section', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText('Error Reporting')).toBeInTheDocument();
  });

  it('renders analytics section', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('shows "No Preference Set" when no consent stored', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText('No Preference Set')).toBeInTheDocument();
  });

  it('enables analytics when accept button clicked', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Enable Analytics'));
    expect(localStorage.getItem('lenr-analytics-consent')).toBe('accepted');
    expect(screen.getByText('Analytics Enabled')).toBeInTheDocument();
  });

  it('disables analytics when decline button clicked', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Disable Analytics'));
    expect(localStorage.getItem('lenr-analytics-consent')).toBe('declined');
    expect(screen.getByText('Analytics Disabled')).toBeInTheDocument();
  });

  it('shows saved confirmation after analytics change', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Enable Analytics'));
    expect(screen.getByText(/analytics preference has been saved/)).toBeInTheDocument();
  });

  it('enables error reporting when accept button clicked', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Enable Error Reporting'));
    expect(localStorage.getItem('lenr-error-reporting-consent')).toBe('accepted');
  });

  it('shows reload message after error reporting change', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Disable Error Reporting'));
    expect(screen.getByText(/reload the page/)).toBeInTheDocument();
    expect(screen.getByText('Reload Page Now')).toBeInTheDocument();
  });

  it('shows error reporting saved confirmation', () => {
    render(<PrivacyPreferences />);
    fireEvent.click(screen.getByText('Enable Error Reporting'));
    expect(screen.getByText(/error reporting preference has been saved/)).toBeInTheDocument();
  });

  it('renders transparency section with Umami dashboard link', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText('View Public Analytics Dashboard')).toBeInTheDocument();
  });

  it('renders what gets reported and what is not', () => {
    render(<PrivacyPreferences />);
    expect(screen.getByText("What Gets Reported:")).toBeInTheDocument();
    expect(screen.getByText("What's NOT Reported:")).toBeInTheDocument();
  });

  it('loads existing consent from localStorage', () => {
    localStorage.setItem('lenr-analytics-consent', 'accepted');
    render(<PrivacyPreferences />);
    expect(screen.getByText('Analytics Enabled')).toBeInTheDocument();
  });
});
