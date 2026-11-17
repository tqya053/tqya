import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, IconButton, ProgressRing, Row, Screen, Segmented } from '../../components/ui';
import { loadTaskRates } from '../../features/queries';
import { CalorieStatsSection, ExpenseStatsSection, PeriodPicker, TaskStatsSection } from '../../features/statsSections';
import { useAppData, useQuery } from '../../hooks/useAppData';
import { formatPercent } from '../../lib/format';
import type { Period } from '../../lib/stats';
import { font, spacing, useTheme } from '../../theme';

type Section = 'all' | 'tasks' | 'expenses' | 'calories';

function RateRing({ label, rate }: { label: string; rate: number | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.sm }}>
      <ProgressRing progress={rate ?? 0} color={colors.tasks} size={82} stroke={9}>
        <Text style={[font.heading, { color: colors.text }]}>{formatPercent(rate)}</Text>
      </ProgressRing>
      <Text style={[font.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { colors } = useTheme();
  const { today } = useAppData();
  const [period, setPeriod] = useState<Period>('daily');
  const [section, setSection] = useState<Section>('all');
  const { data: rates } = useQuery((db) => loadTaskRates(db, today), []);
  const show = (s: Section) => section === 'all' || section === s;

  return (
    <Screen
      title="Statistics"
      subtitle="Reports & analytics"
      right={<IconButton icon="cloud-download-outline" label="Backup and settings" onPress={() => router.push('/settings')} filled />}
    >
      <Segmented
        options={[
          { value: 'all', label: 'All' },
          { value: 'tasks', label: 'Tasks' },
          { value: 'expenses', label: 'Money' },
          { value: 'calories', label: 'Calories' },
        ]}
        value={section}
        onChange={setSection}
      />
      <PeriodPicker value={period} onChange={setPeriod} />

      {show('tasks') && (
        <>
          <Card>
            <Text style={[font.heading, { color: colors.text, marginBottom: spacing.lg }]}>Completion rate</Text>
            <Row>
              <RateRing label="Today" rate={rates?.daily ?? null} />
              <RateRing label="This week" rate={rates?.weekly ?? null} />
              <RateRing label="This month" rate={rates?.monthly ?? null} />
            </Row>
          </Card>
          <TaskStatsSection period={period} />
        </>
      )}
      {show('expenses') && <ExpenseStatsSection period={period} />}
      {show('calories') && <CalorieStatsSection period={period} />}
    </Screen>
  );
}
