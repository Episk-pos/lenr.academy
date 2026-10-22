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

const locales = { en, de, es, fr, ja, ru, zh, it, pt, uk, pl, ko, hi };

export async function createTestI18n(lng: string): Promise<I18nInstance> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: Object.fromEntries(
      Object.entries(locales).map(([code, translation]) => [code, { translation }])
    ),
    interpolation: { escapeValue: false },
  });
  return instance;
}
