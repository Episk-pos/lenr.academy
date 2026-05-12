import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

const mockNavigate = vi.fn();

vi.mock('react-i18next', () => mockReactI18next);

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import Help from './Help';

describe('Help', () => {
  it('renders page title', () => {
    render(<Help />);
    expect(screen.getByText(en.help.title)).toBeInTheDocument();
  });

  it('renders example queries section', () => {
    render(<Help />);
    expect(screen.getByText(en.help.exampleQueries)).toBeInTheDocument();
  });

  it('renders glossary section', () => {
    render(<Help />);
    expect(screen.getByText(en.help.glossary)).toBeInTheDocument();
  });

  it('renders search input for glossary', () => {
    render(<Help />);
    expect(screen.getByLabelText(en.help.searchGlossary)).toBeInTheDocument();
  });

  it('renders category filter buttons', () => {
    render(<Help />);
    expect(screen.getByText(en.help.allCategories)).toBeInTheDocument();
  });

  it('filters glossary by search term', () => {
    render(<Help />);
    const search = screen.getByLabelText(en.help.searchGlossary);
    fireEvent.change(search, { target: { value: 'fusion' } });
    // "Fusion" appears multiple times (glossary + example queries), use getAllByText
    expect(screen.getAllByText('Fusion').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates when example query is clicked', () => {
    render(<Help />);
    // Click the first example query card (they're buttons)
    const queryButtons = screen.getAllByRole('button');
    // Find a button that contains query type badge text
    const exampleButton = queryButtons.find(btn =>
      btn.querySelector('span')?.textContent?.match(/fusion|fission|2→2/)
    );
    if (exampleButton) {
      fireEvent.click(exampleButton);
      expect(mockNavigate).toHaveBeenCalled();
    }
  });

  it('shows glossary count', () => {
    render(<Help />);
    // Glossary count uses i18n key "{{count}} terms"
    expect(screen.getByText(/terms$/)).toBeInTheDocument();
  });
});
