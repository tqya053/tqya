/**
 * Tiny i18n core (no React). Source strings are written in English and used
 * as keys: `t('Add task')`. Arabic translations live in `ar.ts`; anything
 * missing falls back to English. `{name}` placeholders are interpolated.
 */
import { AR } from './ar';

export type Lang = 'en' | 'ar';
export type LanguagePreference = 'system' | Lang;

let current: Lang = 'en';

export function setLang(lang: Lang) {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function isRTL(lang: Lang = current): boolean {
  return lang === 'ar';
}

export function t(key: string, params?: Record<string, string | number>, lang: Lang = current): string {
  let s = lang === 'ar' ? AR[key] ?? key : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Default category names are stored in English; show them translated. */
export function categoryLabel(name: string): string {
  return t(`cat:${name}`) === `cat:${name}` ? name : t(`cat:${name}`);
}

/** Validation errors thrown by the data layer are English; translate known ones. */
export function translateError(message: string): string {
  const quoted = message.match(/^"(.+)" already exists$/);
  if (quoted) return t('"{name}" already exists', { name: quoted[1] });
  return t(message);
}
