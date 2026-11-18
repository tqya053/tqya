import { useI18n } from '../i18n/I18nProvider';
import { t, translateError, type LanguagePreference } from '../i18n/translate';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Divider, Field, haptic, Row, Segmented, type IconName } from '../components/ui';
import { importData, resetAllData, validateBackup } from '../db/backup';
import type { ThemePreference } from '../db/types';
import { pickBackupFile, shareBackup } from '../features/backupIO';
import { useAppData } from '../hooks/useAppData';
import { font, spacing, useTheme } from '../theme';

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: spacing.md })}>
      <Row>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={[font.body, { color: colors.text, flex: 1 }]}>{label}</Text>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textFaint} />
      </Row>
    </Pressable>
  );
}

/** One-tap currencies; anything else can be typed under "Other". */
const QUICK_CURRENCIES = ['₪', '$'];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, settings, updateSetting, mutate } = useAppData();
  const [goal, setGoal] = useState(String(settings.calorieGoal));
  const [currency, setCurrency] = useState(settings.currency);
  const [customCurrency, setCustomCurrency] = useState(false);
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      await shareBackup(db);
    } catch (e) {
      Alert.alert(t('Backup failed'), translateError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const json = await pickBackupFile();
      if (!json) return;
      const backup = validateBackup(json);
      const n = backup.data;
      Alert.alert(
        t('Restore this backup?'),
        t('Backup from {date}:', { date: backup.exportedAt.slice(0, 10) || '—' }) +
          '\n' +
          `• ${t('{n} tasks', { n: n.daily_tasks.length + n.one_time_tasks.length })}\n` +
          `• ${t('{n} expenses', { n: n.expenses.length })}\n` +
          `• ${t('{n} calorie entries', { n: n.calorie_entries.length })}\n\n` +
          t('All current data on this phone will be replaced.'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Restore'),
            style: 'destructive',
            onPress: async () => {
              const ok = await mutate((d) => importData(d, json));
              if (ok) {
                haptic('success');
                Alert.alert(t('Restored'), t('Your data has been restored from the backup.'));
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(t('Could not read backup'), translateError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const doReset = () => {
    Alert.alert(t('Reset all data?'), t('This permanently deletes all tasks, expenses, calorie entries and settings on this phone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Continue'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('Are you absolutely sure?'), t('Consider exporting a backup first. This cannot be undone.'), [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Delete everything'),
              style: 'destructive',
              onPress: async () => {
                await mutate((d) => resetAllData(d));
                haptic('warning');
                setGoal('2000');
                setCurrency('$');
              },
            },
          ]),
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>{t('Language')} · Language</Text>
        <Segmented<LanguagePreference>
          options={[
            { value: 'system', label: t('Phone language') },
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]}
          value={settings.language}
          onChange={(v) => updateSetting('language', v)}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>{t('Appearance')}</Text>
        <Segmented<ThemePreference>
          options={[
            { value: 'system', label: t('System') },
            { value: 'light', label: t('Light') },
            { value: 'dark', label: t('Dark') },
          ]}
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v)}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>{t('Preferences')}</Text>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label={t('Daily calorie goal (kcal)')} value={goal} onChangeText={(v) => setGoal(v.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" />
          </View>
          <Button label={t('Save')} compact variant="secondary" disabled={Number(goal) === settings.calorieGoal || !Number(goal)} onPress={() => updateSetting('calorieGoal', Number(goal))} style={{ minHeight: 50 }} />
        </Row>
        <View style={{ gap: 6 }}>
          <Text style={[font.label, { color: colors.textMuted }]}>{t('Currency')}</Text>
          <Segmented<string>
            options={[
              { value: '₪', label: `₪ ${t('Shekel')}` },
              { value: '$', label: `$ ${t('Dollar')}` },
              { value: 'other', label: t('Other') },
            ]}
            value={QUICK_CURRENCIES.includes(settings.currency) && !customCurrency ? settings.currency : 'other'}
            onChange={(v) => {
              if (v === 'other') {
                setCustomCurrency(true);
                return;
              }
              setCustomCurrency(false);
              setCurrency(v);
              updateSetting('currency', v);
            }}
          />
        </View>
        {(customCurrency || !QUICK_CURRENCIES.includes(settings.currency)) && (
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label={t('Currency symbol')} value={currency} onChangeText={setCurrency} maxLength={5} autoCapitalize="characters" placeholder="€" />
            </View>
            <Button label={t('Save')} compact variant="secondary" disabled={currency.trim() === settings.currency || !currency.trim()} onPress={() => updateSetting('currency', currency.trim())} style={{ minHeight: 50 }} />
          </Row>
        )}
        <Divider />
        <LinkRow icon="pricetags-outline" label={t('Expense categories')} onPress={() => router.push('/categories')} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>{t('Backup & restore')}</Text>
        <Text style={[font.body, { color: colors.textMuted }]}>
          {t('All data is stored only on this phone. Export a JSON backup to keep a copy or move to a new phone.')}
        </Text>
        <Button label={t('Export backup (JSON)')} icon="share-outline" onPress={doExport} loading={busy === 'export'} />
        <Button label={t('Restore from backup')} icon="download-outline" variant="secondary" onPress={doImport} loading={busy === 'import'} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.danger }]}>{t('Danger zone')}</Text>
        <Button label={t('Reset all data')} icon="trash-outline" variant="danger" onPress={doReset} />
      </Card>

      <Text style={[font.caption, { color: colors.textFaint, textAlign: 'center' }]}>
        {t('Daily Tracker')} v{Constants.expoConfig?.version ?? '1.0.0'} · {t('Works offline')} · {t('No account needed')}
      </Text>
    </ScrollView>
  );
}
