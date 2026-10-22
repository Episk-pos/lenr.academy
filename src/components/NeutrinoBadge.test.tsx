import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import NeutrinoBadge from './NeutrinoBadge';

describe('NeutrinoBadge', () => {
  it('renders ν with an explanatory title for left-handed neutrinos', () => {
    render(<NeutrinoBadge neutrino="left" />);
    const badge = screen.getByTestId('neutrino-badge');
    expect(badge).toHaveTextContent('ν');
    expect(badge.getAttribute('title')).toMatch(/Neutrino \(ν, left-handed\)/);
    expect(badge).toHaveAttribute('data-neutrino', 'left');
  });

  it('renders ν̄ with an explanatory title for right-handed antineutrinos', () => {
    render(<NeutrinoBadge neutrino="right" />);
    const badge = screen.getByTestId('neutrino-badge');
    expect(badge).toHaveTextContent('ν̄');
    expect(badge.getAttribute('title')).toMatch(/Antineutrino/);
  });

  it('renders an em dash for reactions without neutrinos', () => {
    render(<NeutrinoBadge neutrino="none" />);
    const badge = screen.getByTestId('neutrino-badge');
    expect(badge).toHaveTextContent('—');
    expect(badge).toHaveAttribute('title', 'No neutrino involved');
  });

  it('exposes the explanation to screen readers', () => {
    render(<NeutrinoBadge neutrino="none" />);
    expect(screen.getByText('No neutrino involved')).toHaveClass('sr-only');
  });

  it('uses dark-mode aware colors', () => {
    render(<NeutrinoBadge neutrino="left" />);
    expect(screen.getByTestId('neutrino-badge').className).toMatch(/dark:bg-blue-900/);
  });
});
