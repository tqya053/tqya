import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DATABASE_NAME, migrate } from '../db/schema';
import type { DB } from '../db/types';
import { AppDataProvider } from '../hooks/useAppData';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import { ThemeProvider, useTheme } from '../theme';

// react-native-svg's touch handlers trigger a harmless React DOM warning in browser previews only.
if (Platform.OS === 'web') LogBox.ignoreLogs(['Unknown event handler property']);

function Themed({ children }: { children: ReactNode }) {
  const { colors, dark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </>
  );
}

function AppStack() {
  const { colors } = useTheme();
  const { t, rtl } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: rtl ? 'slide_from_left' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: t('Settings') }} />
      <Stack.Screen name="categories" options={{ title: t('Expense categories') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* The database file lives in the app's private storage, so every install has its own data. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={(db) => migrate(db as unknown as DB)}>
        <AppDataProvider>
          {(settings) => (
            <I18nProvider preference={settings.language}>
              <ThemeProvider preference={settings.theme}>
                <Themed>
                  <AppStack key={settings.language} />
                </Themed>
              </ThemeProvider>
            </I18nProvider>
          )}
        </AppDataProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
