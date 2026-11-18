import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference } from '../db/types';

const palette = {
  light: {
    bg: '#F4F5F8',
    card: '#FFFFFF',
    cardAlt: '#F0F2F6',
    text: '#0E1525',
    textMuted: '#5F6B7E',
    textFaint: '#97A1B2',
    border: '#E3E6EC',
    primary: '#4F46E5',
    primarySoft: '#EAE9FD',
    onPrimary: '#FFFFFF',
    tasks: '#4F46E5',
    tasksSoft: '#EAE9FD',
    expenses: '#0E9F6E',
    expensesSoft: '#DDF5EC',
    calories: '#EA6A0C',
    caloriesSoft: '#FDEBDD',
    danger: '#DC2626',
    dangerSoft: '#FDE5E5',
    success: '#16A34A',
    chartGrid: '#E8EAEF',
    overlay: 'rgba(14, 21, 37, 0.45)',
  },
  dark: {
    bg: '#0B0E14',
    card: '#151A23',
    cardAlt: '#1D2330',
    text: '#EEF1F6',
    textMuted: '#9AA5B6',
    textFaint: '#677184',
    border: '#252C3A',
    primary: '#8B85FF',
    primarySoft: '#25234A',
    onPrimary: '#0B0E14',
    tasks: '#8B85FF',
    tasksSoft: '#25234A',
    expenses: '#34D399',
    expensesSoft: '#123326',
    calories: '#FB923C',
    caloriesSoft: '#3A2312',
    danger: '#F87171',
    dangerSoft: '#3A1717',
    success: '#4ADE80',
    chartGrid: '#232A37',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

export type Colors = typeof palette.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

const LATIN_SPACING = Object.fromEntries(Object.entries(font).map(([k, v]) => [k, 'letterSpacing' in v ? v.letterSpacing : 0]));

/** Arabic letters must connect, so negative letter-spacing is removed for Arabic. */
export function applyFontLocale(lang: 'en' | 'ar') {
  for (const [k, v] of Object.entries(font)) {
    if ('letterSpacing' in v) (v as { letterSpacing: number }).letterSpacing = lang === 'ar' ? 0 : LATIN_SPACING[k];
  }
}

export interface Theme {
  dark: boolean;
  colors: Colors;
}

const ThemeContext = createContext<Theme>({ dark: false, colors: palette.light });

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const value = useMemo(() => ({ dark, colors: dark ? palette.dark : palette.light }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
