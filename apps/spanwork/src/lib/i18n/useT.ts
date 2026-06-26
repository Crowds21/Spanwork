import { useContext } from 'react';

import { I18nContext } from './I18nProvider';

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useT must be used within I18nProvider');
  }
  return ctx.t;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useLocale must be used within I18nProvider');
  }
  return ctx.locale;
}
