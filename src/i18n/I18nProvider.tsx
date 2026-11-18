import { getLocales } from 'expo-localization';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { applyFontLocale } from '../theme';
import { isRTL, setLang, t, type Lang, type LanguagePreference } from './translate';

// Layout direction is controlled per language with the `direction` style below,
// so the native "auto RTL from phone language" must stay off (it would flip twice).
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch {
  // not available on every platform
}

export function resolveLang(pref: LanguagePreference): Lang {
  if (pref === 'ar' || pref === 'en') return pref;
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

interface I18n {
  lang: Lang;
  rtl: boolean;
  t: typeof t;
}

const Ctx = createContext<I18n>({ lang: 'en', rtl: false, t });

export function I18nProvider({ preference, children }: { preference: LanguagePreference; children: ReactNode }) {
  const lang = resolveLang(preference);
  // Set synchronously so every formatter used during this render sees the language.
  setLang(lang);
  applyFontLocale(lang);
  const value = useMemo(() => ({ lang, rtl: isRTL(lang), t: (k: string, p?: Record<string, string | number>) => t(k, p, lang) }), [lang]);
  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1, direction: value.rtl ? 'rtl' : 'ltr' }}>{children}</View>
    </Ctx.Provider>
  );
}

/** Translation function + current language/direction. Re-renders on language change. */
export function useI18n(): I18n {
  return useContext(Ctx);
}
