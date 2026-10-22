import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockReactI18next } from '../test-utils/i18nMock';
import en from '../i18n/locales/en.json';

vi.mock('react-i18next', () => mockReactI18next);

import AboutToolSection from './AboutToolSection';

describe('AboutToolSection', () => {
  it('is collapsed by default and expands on toggle', () => {
    render(
      <AboutToolSection>
        <p>Explanation text</p>
      </AboutToolSection>
    );
    const toggle = screen.getByRole('button', { name: en.common.aboutThisTool });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const content = document.getElementById(toggle.getAttribute('aria-controls')!);
    expect(content?.className).toMatch(/max-h-0/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(content?.className).toMatch(/max-h-\[800px\]/);
    expect(screen.getByText('Explanation text')).toBeInTheDocument();
  });

  it('respects defaultOpen', () => {
    render(
      <AboutToolSection defaultOpen>
        <p>Body</p>
      </AboutToolSection>
    );
    expect(screen.getByRole('button', { name: en.common.aboutThisTool })).toHaveAttribute('aria-expanded', 'true');
  });
});
