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
      ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    },
    markLanguageSelected: mockMarkLanguageSelected,
  }),
}));

import LanguageSelectionModal from './LanguageSelectionModal';

describe('LanguageSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not open', () => {
    const { container } = render(<LanguageSelectionModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    render(<LanguageSelectionModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('language-selection-modal')).toBeInTheDocument();
  });

  it('shows all supported languages', () => {
    render(<LanguageSelectionModal isOpen={true} onClose={vi.fn()} />);
    // English appears as both nativeName and name, so use getAllByText
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText('日本語')).toBeInTheDocument();
  });

  it('shows language flags', () => {
    render(<LanguageSelectionModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getAllByText('🇬🇧').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('🇩🇪').length).toBeGreaterThanOrEqual(1);
  });

  it('calls setLanguage when language button clicked', () => {
    render(<LanguageSelectionModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Deutsch'));
    expect(mockSetLanguage).toHaveBeenCalledWith('de');
  });

  it('calls markLanguageSelected and onClose on confirm', () => {
    const onClose = vi.fn();
    render(<LanguageSelectionModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText(en.language.confirmSelection));
    expect(mockMarkLanguageSelected).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on cancel', () => {
    const onClose = vi.fn();
    render(<LanguageSelectionModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText(en.common.cancel));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<LanguageSelectionModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(en.common.close));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows header with globe icon and title', () => {
    render(<LanguageSelectionModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(en.language.selectLanguage)).toBeInTheDocument();
  });
});
