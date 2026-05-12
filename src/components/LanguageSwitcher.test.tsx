import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

const mockSetLanguage = vi.fn();
const mockMarkLanguageSelected = vi.fn();

vi.mock('react-i18next', () => mockReactI18next);

// Mock LanguageContext
vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: mockSetLanguage,
    supportedLanguages: {
      en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
      de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    },
    markLanguageSelected: mockMarkLanguageSelected,
  }),
}));

import LanguageSwitcher from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders button with language label', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByLabelText(en.language.changeLanguage)).toBeInTheDocument();
  });

  it('shows current language name when not compact', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('opens dropdown when button clicked', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByLabelText(en.language.changeLanguage));
    // Dropdown portal content - language options appear
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText(en.language.selectLanguage)).toBeInTheDocument();
  });

  it('calls setLanguage and markLanguageSelected when language selected', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByLabelText(en.language.changeLanguage));
    fireEvent.click(screen.getByText('Deutsch'));
    expect(mockSetLanguage).toHaveBeenCalledWith('de');
    expect(mockMarkLanguageSelected).toHaveBeenCalledOnce();
  });

  it('closes dropdown after language selection', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByLabelText(en.language.changeLanguage));
    expect(screen.getByText(en.language.selectLanguage)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Deutsch'));
    // Dropdown should close - selectLanguage header should disappear
    expect(screen.queryByText(en.language.selectLanguage)).not.toBeInTheDocument();
  });

  it('accepts className prop', () => {
    const { container } = render(<LanguageSwitcher className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('shows compact mode without language name', () => {
    render(<LanguageSwitcher compact />);
    // In compact mode, language name is not shown (only Globe icon)
    expect(screen.queryByText('English')).not.toBeInTheDocument();
  });
});
