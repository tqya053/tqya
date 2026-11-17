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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: spacing.md })}>
      <Row>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={[font.body, { color: colors.text, flex: 1 }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Row>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, settings, updateSetting, mutate } = useAppData();
  const [goal, setGoal] = useState(String(settings.calorieGoal));
  const [currency, setCurrency] = useState(settings.currency);
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      await shareBackup(db);
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
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
        'Restore this backup?',
        `Backup from ${backup.exportedAt.slice(0, 10) || 'unknown date'}:\n` +
          `• ${n.daily_tasks.length + n.one_time_tasks.length} tasks\n` +
          `• ${n.expenses.length} expenses\n` +
          `• ${n.calorie_entries.length} calorie entries\n\n` +
          'All current data on this phone will be replaced.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              const ok = await mutate((d) => importData(d, json));
              if (ok) {
                haptic('success');
                Alert.alert('Restored', 'Your data has been restored from the backup.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Could not read backup', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doReset = () => {
    Alert.alert('Reset all data?', 'This permanently deletes all tasks, expenses, calorie entries and settings on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Are you absolutely sure?', 'Consider exporting a backup first. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete everything',
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
        <Text style={[font.heading, { color: colors.text }]}>Appearance</Text>
        <Segmented<ThemePreference>
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v)}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>Preferences</Text>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Daily calorie goal (kcal)" value={goal} onChangeText={(t) => setGoal(t.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" />
          </View>
          <Button label="Save" compact variant="secondary" disabled={Number(goal) === settings.calorieGoal || !Number(goal)} onPress={() => updateSetting('calorieGoal', Number(goal))} style={{ minHeight: 50 }} />
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Currency symbol" value={currency} onChangeText={setCurrency} maxLength={5} autoCapitalize="characters" placeholder="$" />
          </View>
          <Button label="Save" compact variant="secondary" disabled={currency.trim() === settings.currency || !currency.trim()} onPress={() => updateSetting('currency', currency.trim())} style={{ minHeight: 50 }} />
        </Row>
        <Divider />
        <LinkRow icon="pricetags-outline" label="Expense categories" onPress={() => router.push('/categories')} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>Backup & restore</Text>
        <Text style={[font.body, { color: colors.textMuted }]}>
          All data is stored only on this phone. Export a JSON backup to keep a copy or move to a new phone.
        </Text>
        <Button label="Export backup (JSON)" icon="share-outline" onPress={doExport} loading={busy === 'export'} />
        <Button label="Restore from backup" icon="download-outline" variant="secondary" onPress={doImport} loading={busy === 'import'} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.danger }]}>Danger zone</Text>
        <Button label="Reset all data" icon="trash-outline" variant="danger" onPress={doReset} />
      </Card>

      <Text style={[font.caption, { color: colors.textFaint, textAlign: 'center' }]}>
        Daily Tracker v{Constants.expoConfig?.version ?? '1.0.0'} · Works offline · No account needed
      </Text>
    </ScrollView>
  );
}
