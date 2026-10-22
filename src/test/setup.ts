// Vitest test setup file
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/locales/en.json';

// Give components that call useTranslation() a real English i18n instance, so tests
// that don't mock react-i18next render real strings instead of raw keys.
// Test files can still vi.mock('react-i18next') or wrap in their own I18nextProvider.
const testI18n = createInstance();
void testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

// Cleanup after each test case (for React components)
afterEach(() => {
  cleanup();
});
