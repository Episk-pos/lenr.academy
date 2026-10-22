/**
 * Real i18next instances for language-switching tests.
 *
 * Unlike the English-only mock in i18nMock.ts, these load every locale so tests can
 * render components in e.g. 'de' or 'hi' (wrap with <I18nextProvider i18n={instance}>)
 * and assert that no hardcoded English leaks through.
 */
import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import ja from '../i18n/locales/ja.json';
import ru from '../i18n/locales/ru.json';
import zh from '../i18n/locales/zh.json';
import it from '../i18n/locales/it.json';
import pt from '../i18n/locales/pt.json';
import uk from '../i18n/locales/uk.json';
import pl from '../i18n/locales/pl.json';
import ko from '../i18n/locales/ko.json';
import hi from '../i18n/locales/hi.json';

type Tree = Record<string, unknown>;

const locales: Record<string, Tree> = { en, de, es, fr, ja, ru, zh, it, pt, uk, pl, ko, hi };

/**
 * Return a copy of `target` where every leaf that exists in English but is missing
 * from `target` is replaced by a pseudo-localized marker: `⟦lng:key⟧` followed by the
 * English value's {{placeholders}}. The marker deliberately contains no English words,
 * so "no English leaks" assertions stay meaningful even before a locale has been
 * translated, while keys that ARE translated keep their real values.
 */
function fillMissingWithPseudo(source: Tree, target: Tree, lng: string, prefix = ''): Tree {
  const out: Tree = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const existing = target[key];
      out[key] = fillMissingWithPseudo(
        value as Tree,
        existing && typeof existing === 'object' ? (existing as Tree) : {},
        lng,
        path,
      );
    } else if (!(key in target)) {
      const placeholders = typeof value === 'string' ? value.match(/\{\{[^}]+\}\}/g) ?? [] : [];
      out[key] = [`⟦${lng}:${path}⟧`, ...placeholders].join(' ');
    }
  }
  return out;
}

export interface TestI18nOptions {
  /**
   * Fill keys missing from non-English locales with pseudo-localized markers instead of
   * falling back to English. Use this for "no hardcoded English" assertions that must
   * not depend on every locale already having every key.
   */
  pseudoFillMissing?: boolean;
}

export async function createTestI18n(lng: string, options: TestI18nOptions = {}): Promise<I18nInstance> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: Object.fromEntries(
      Object.entries(locales).map(([code, translation]) => [
        code,
        {
          translation:
            options.pseudoFillMissing && code !== 'en'
              ? fillMissingWithPseudo(en as Tree, translation, code)
              : translation,
        },
      ])
    ),
    interpolation: { escapeValue: false },
  });
  return instance;
}
