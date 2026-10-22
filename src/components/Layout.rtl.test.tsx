/**
 * Layout in a right-to-left language: the sidebar, main-content offset and
 * collapse toggle must use logical (start/end) utilities so they mirror when
 * <html dir="rtl">, and direction-meaning icons must flip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import Layout from './Layout';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LayoutProvider } from '../contexts/LayoutContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { createTestI18n } from '../test-utils/i18nInstance';

// Banners/modals pull in service-worker, database and network state that is
// irrelevant to direction handling.
vi.mock('./DatabaseUpdateBanner', () => ({ default: () => null }));
vi.mock('./AppUpdateBanner', () => ({ default: () => null }));
vi.mock('./PrivacyBanner', () => ({ default: () => null }));
vi.mock('./ChangelogModal', () => ({ default: () => null }));
vi.mock('./LanguageSelectionModal', () => ({ default: () => null }));
vi.mock('../services/changelog', () => ({ fetchReleaseNotes: vi.fn(() => new Promise(() => {})) }));

function renderLayout(i18n: I18nInstance) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <LanguageProvider>
          <LayoutProvider>
            <MemoryRouter>
              <Layout>
                <p>content</p>
              </Layout>
            </MemoryRouter>
          </LayoutProvider>
        </LanguageProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

describe('Layout in RTL (Arabic)', () => {
  let i18n: I18nInstance;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    localStorage.setItem('lenr-language-selected', 'true');
    localStorage.setItem('desktopSidebarCollapsed', 'false');
    i18n = await createTestI18n('ar');
    document.documentElement.dir = i18n.dir('ar');
    document.documentElement.lang = 'ar';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('resolves Arabic as a right-to-left language', () => {
    expect(i18n.dir('ar')).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('anchors the mobile and desktop sidebars to the inline-start edge', () => {
    renderLayout(i18n);
    const mobile = screen.getByTestId('mobile-sidebar');
    expect(mobile).toHaveClass('start-0');
    expect(mobile).not.toHaveClass('left-0');

    const desktop = screen.getByTestId('desktop-sidebar');
    expect(desktop).toHaveClass('lg:start-0');
    // The sidebar's divider sits on its inline-end edge (facing the content)
    expect(desktop.firstElementChild).toHaveClass('border-e');
    expect(desktop.firstElementChild).not.toHaveClass('border-r');
  });

  it('offsets the main content with inline-start padding', () => {
    renderLayout(i18n);
    const content = screen.getByText('content').closest('main')!.parentElement!;
    expect(content).toHaveClass('lg:ps-64');
    expect(content.className).not.toMatch(/\blg:pl-/);
  });

  it('places the collapse toggle on the inline-end edge and flips its chevron', () => {
    renderLayout(i18n);
    const toggle = screen.getByTitle(i18n.t('sidebar.collapse'));
    expect(toggle).toHaveClass('-end-3');
    expect(toggle.querySelector('svg')).toHaveClass('rtl:rotate-180');
  });
});
