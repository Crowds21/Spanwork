import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getLocale, type Locale } from './index';
import { getTranslator, type Translator } from './translate';

export interface I18nContextValue {
  locale: Locale;
  t: Translator;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => getLocale());

  useEffect(() => {
    const onLanguageChange = () => setLocale(getLocale());
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(getTranslator(locale), [locale]);

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
