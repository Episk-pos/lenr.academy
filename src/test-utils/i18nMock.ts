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
function lookup(key: string): unknown {
  let value: unknown = en;
  for (const part of key.split('.')) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function resolveI18nKey(key: string, params?: Record<string, unknown>): string {
  let value = lookup(key);
  // English plural keys (key_one / key_other) when a count is supplied
  if (typeof value !== 'string' && params && typeof params.count === 'number') {
    value = lookup(`${key}_${params.count === 1 ? 'one' : 'other'}`) ?? lookup(`${key}_other`);
  }
  if (typeof value !== 'string') return key;
  let result = value;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.split(`{{${k}}}`).join(String(v));
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
    i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: () => Promise.resolve() },
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
