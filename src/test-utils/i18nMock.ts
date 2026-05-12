/**
 * Shared i18n mock for test files.
 *
 * Usage in test files:
 *   import { mockReactI18next } from '../test-utils/i18nMock';
 *   vi.mock('react-i18next', () => mockReactI18next);
 */
import en from '../i18n/locales/en.json';

/**
 * Resolve a dotted i18n key against the English locale JSON.
 * Supports {{param}} interpolation when params are provided.
 */
function resolveI18nKey(key: string, params?: Record<string, unknown>): string {
  const parts = key.split('.');
  let value: unknown = en;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  let result = value as string;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(`{{${k}}}`, String(v));
    });
  }
  return result;
}

/**
 * Standard react-i18next mock with full key resolution and interpolation.
 * Use: vi.mock('react-i18next', () => mockReactI18next);
 */
export const mockReactI18next = {
  useTranslation: () => ({
    t: resolveI18nKey,
  }),
  Trans: ({ children, i18nKey }: { children?: React.ReactNode; i18nKey?: string }) => {
    if (i18nKey) {
      // Strip XML-like tags and return plain text for testing
      const raw = resolveI18nKey(i18nKey);
      return raw.replace(/<[^>]+>/g, '');
    }
    return children;
  },
  initReactI18next: {
    type: '3rdParty' as const,
    init: () => {},
  },
};
