import type { DB, LanguagePreference, Settings, ThemePreference } from './types';

export const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2000,
  currency: '$',
  theme: 'system',
  language: 'system',
};

export async function getSettings(db: DB): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings', []);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const goal = Number(map.get('calorieGoal'));
  const theme = map.get('theme') as ThemePreference | undefined;
  const language = map.get('language') as LanguagePreference | undefined;
  return {
    calorieGoal: Number.isFinite(goal) && goal > 0 ? Math.round(goal) : DEFAULT_SETTINGS.calorieGoal,
    currency: map.get('currency') ?? DEFAULT_SETTINGS.currency,
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_SETTINGS.theme,
    language: language === 'en' || language === 'ar' || language === 'system' ? language : DEFAULT_SETTINGS.language,
  };
}

export async function setSetting<K extends keyof Settings>(db: DB, key: K, value: Settings[K]): Promise<void> {
  if (key === 'calorieGoal') {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0 || n > 20000) throw new Error('Calorie goal must be between 1 and 20000');
  }
  if (key === 'currency' && (String(value).trim().length === 0 || String(value).length > 5)) {
    throw new Error('Currency symbol must be 1–5 characters');
  }
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value).trim()]);
}
