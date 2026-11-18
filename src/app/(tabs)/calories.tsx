import { t } from '../../i18n/translate';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, EmptyState, FadeIn, Field, ProgressRing, Row, Screen, SectionTitle, Segmented, Sheet, Stat } from '../../components/ui';
import { listCalorieEntries } from '../../db/calories';
import type { CalorieEntry } from '../../db/types';
import { CalorieRow, DayGroups, EditCalorieSheet } from '../../features/EntryRows';
import { CalorieForm } from '../../features/forms';
import { HistoryFilter, rangeBounds, useHistoryRange } from '../../features/HistoryFilter';
import { CalorieStatsSection } from '../../features/statsSections';
import { useAppData, useQuery } from '../../hooks/useAppData';
import { formatNumber } from '../../lib/format';
import { font, spacing, useTheme } from '../../theme';

const PAGE = 100;

function GoalSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { settings, updateSetting } = useAppData();
  const [value, setValue] = useState(String(settings.calorieGoal));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Daily calorie goal')}>
      <Field
        label={t('Goal (kcal per day)')}
        value={value}
        onChangeText={(t) => setValue(t.replace(/\D/g, '').slice(0, 5))}
        keyboardType="number-pad"
        autoFocus
      />
      <Button
        label={t('Save goal')}
        icon="checkmark"
        color={colors.calories}
        disabled={!Number(value)}
        onPress={async () => {
          if (await updateSetting('calorieGoal', Number(value))) onClose();
        }}
      />
    </Sheet>
  );
}

export default function CaloriesScreen() {
  const { colors } = useTheme();
  const { today, settings } = useAppData();
  const goal = settings.calorieGoal;
  const [tab, setTab] = useState<'add' | 'history' | 'stats'>('add');
  const [editing, setEditing] = useState<CalorieEntry | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [range, setRange] = useHistoryRange();
  const [limit, setLimit] = useState(PAGE);

  const { data: todays = [] } = useQuery((db) => listCalorieEntries(db, today, today), []);
  const bounds = rangeBounds(range, today);
  const { data: history = [] } = useQuery(
    (db) => (tab === 'history' ? listCalorieEntries(db, bounds.start, bounds.end) : Promise.resolve([])),
    [tab, bounds.start, bounds.end],
  );
  const total = todays.reduce((a, e) => a + e.calories, 0);
  const left = goal - total;
  const historyTotal = history.reduce((a, e) => a + e.calories, 0);
  const historyDays = new Set(history.map((e) => e.date)).size;

  return (
    <Screen title={t('Calories')} subtitle={t('Today {value}', { value: `${formatNumber(total)} ${t('kcal')}` })}>
      <Segmented
        options={[
          { value: 'add', label: t('Add') },
          { value: 'history', label: t('History') },
          { value: 'stats', label: t('Insights') },
        ]}
        value={tab}
        onChange={setTab}
        accent={colors.calories}
      />

      {tab === 'add' && (
        <>
          <FadeIn>
            <Card>
              <Row gap={spacing.xl}>
                <ProgressRing progress={total / goal} color={left < 0 ? colors.danger : colors.calories} size={108} stroke={11}>
                  <Text style={[font.heading, { color: colors.text }]}>{formatNumber(total)}</Text>
                  <Text style={[font.caption, { color: colors.textMuted }]}>{t('kcal')}</Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[font.caption, { color: colors.textMuted }]}>{left >= 0 ? t('Remaining') : t('Over goal')}</Text>
                  <Text style={[font.title, { color: left >= 0 ? colors.text : colors.danger }]}>{formatNumber(Math.abs(left))}</Text>
                  <Pressable onPress={() => setGoalOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Change calorie goal')}>
                    <Text style={[font.label, { color: colors.calories }]}>{t('Goal {n} kcal · Edit', { n: formatNumber(goal) })}</Text>
                  </Pressable>
                </View>
              </Row>
            </Card>
          </FadeIn>
          <Card>
            <CalorieForm />
          </Card>
          <Card>
            <SectionTitle title={t('Today’s entries')} right={<Text style={[font.heading, { color: colors.calories }]}>{formatNumber(total)} {t('kcal')}</Text>} />
            {todays.length ? (
              todays.map((e) => <CalorieRow key={e.id} e={e} onPress={() => setEditing(e)} />)
            ) : (
              <EmptyState icon="flame-outline" title={t('No entries today')} message={t('Type the calories and press Confirm.')} />
            )}
          </Card>
        </>
      )}

      {tab === 'history' && (
        <>
          <HistoryFilter value={range} onChange={(r) => { setRange(r); setLimit(PAGE); }} color={colors.calories} today={today} />
          <Card>
            <Row>
              <Stat label={t('Total')} value={formatNumber(historyTotal)} hint={t('kcal')} color={colors.calories} />
              <Stat label={t('Days logged')} value={String(historyDays)} />
              <Stat label={t('Avg / day')} value={historyDays ? formatNumber(historyTotal / historyDays) : '—'} hint={t('kcal')} />
            </Row>
          </Card>
          <Card>
            {history.length ? (
              <DayGroups
                items={history.slice(0, limit)}
                total={(items) => items.reduce((a, e) => a + e.calories, 0)}
                formatTotal={(v) => `${formatNumber(v)} ${t('kcal')}${v > goal ? ' ▲' : ''}`}
                renderItem={(e) => <CalorieRow e={e} onPress={() => setEditing(e)} />}
              />
            ) : (
              <EmptyState icon="flame-outline" title={t('No entries')} message={t('Nothing recorded for this filter.')} />
            )}
            {history.length > limit && (
              <Button label={t('Show more ({n})', { n: history.length - limit })} variant="secondary" onPress={() => setLimit(limit + PAGE)} style={{ marginTop: spacing.lg }} />
            )}
          </Card>
        </>
      )}

      {tab === 'stats' && <CalorieStatsSection />}

      <EditCalorieSheet entry={editing} onClose={() => setEditing(null)} />
      {goalOpen && <GoalSheet visible onClose={() => setGoalOpen(false)} />}
    </Screen>
  );
}
