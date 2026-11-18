import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Donut, TrendBars, TrendLine } from '../components/charts';
import { Card, EmptyState, ProgressBar, Row, Segmented, SectionTitle, Stat } from '../components/ui';
import { useAppData, useQuery } from '../hooks/useAppData';
import { categoryLabel, t } from '../i18n/translate';
import { formatShortDate } from '../lib/dates';
import { formatMoney, formatNumber, formatPercent } from '../lib/format';
import { PERIOD_BUCKETS, PERIOD_LABELS, percentChange, type Period } from '../lib/stats';
import { font, spacing, useTheme } from '../theme';
import { loadCalorieStats, loadExpenseStats, loadTaskStats } from './queries';

const PERIODS: Period[] = ['daily', 'weekly', 'monthly'];

/** Period + selected-bucket state. Selection resets to the latest bucket when the period changes. */
function usePeriodSelection(controlled?: Period) {
  const [own, setOwn] = useState<Period>('daily');
  const period = controlled ?? own;
  const [selected, setSelected] = useState(PERIOD_BUCKETS[period] - 1);
  useEffect(() => setSelected(PERIOD_BUCKETS[period] - 1), [period]);
  return { period, setPeriod: setOwn, selected, setSelected };
}

export function PeriodPicker({ value, onChange, accent }: { value: Period; onChange: (p: Period) => void; accent?: string }) {
  return <Segmented options={PERIODS.map((p) => ({ value: p, label: t(PERIOD_LABELS[p]) }))} value={value} onChange={onChange} accent={accent} />;
}

function Hint({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={6} style={{ marginTop: spacing.xs }}>
      <Ionicons name="hand-left-outline" size={12} color={colors.textFaint} />
      <Text style={[font.caption, { color: colors.textFaint }]}>{text}</Text>
    </Row>
  );
}

function ChangeBadge({ change, goodWhenDown }: { change: number | null; goodWhenDown?: boolean }) {
  const { colors } = useTheme();
  if (change === null) return <Text style={[font.caption, { color: colors.textMuted }]}>{t('new')}</Text>;
  const up = change > 0;
  const good = change === 0 ? true : goodWhenDown ? !up : up;
  const color = change === 0 ? colors.textMuted : good ? colors.success : colors.danger;
  return (
    <Row gap={2}>
      <Ionicons name={change === 0 ? 'remove' : up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <Text style={[font.label, { color }]}>{Math.abs(Math.round(change))}%</Text>
    </Row>
  );
}

// ───────────────────────── Tasks ─────────────────────────

export function TaskStatsSection({ period: controlled, showConsistency = true }: { period?: Period; showConsistency?: boolean }) {
  const { colors } = useTheme();
  const { today } = useAppData();
  const { period, setPeriod, selected, setSelected } = usePeriodSelection(controlled);
  const { data } = useQuery((db) => loadTaskStats(db, today, period), [period]);
  if (!data) return <Card style={{ minHeight: 320 }}>{null}</Card>;
  const sel = data.stats[Math.min(selected, data.stats.length - 1)];
  const hasData = data.stats.some((s) => s.total > 0);

  return (
    <>
      <Card>
        <SectionTitle title={t('Task completion')} />
        {!controlled && <View style={{ marginBottom: spacing.lg }}><PeriodPicker value={period} onChange={setPeriod} accent={colors.tasks} /></View>}
        {hasData ? (
          <>
            <Text style={[font.label, { color: colors.textMuted }]}>{sel.bucket.title}</Text>
            <Row style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
              <Stat label={t('Completed')} value={String(sel.completed)} color={colors.tasks} />
              <Stat label={t('Incomplete')} value={String(sel.incomplete)} />
              <Stat label={t('Completion')} value={formatPercent(sel.rate)} />
            </Row>
            <TrendBars
              data={data.stats.map((s) => ({ value: s.completed, rest: s.incomplete, label: s.bucket.label }))}
              color={colors.tasks}
              restColor={colors.border}
              selected={selected}
              onSelect={setSelected}
              integer
            />
            <Row gap={spacing.lg}>
              <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.tasks }} /><Text style={[font.caption, { color: colors.textMuted }]}>{t('Completed')}</Text></Row>
              <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.border }} /><Text style={[font.caption, { color: colors.textMuted }]}>{t('Incomplete')}</Text></Row>
            </Row>
            <Hint text={t('Tap a bar to see that period')} />
          </>
        ) : (
          <EmptyState icon="checkbox-outline" title={t('No tasks yet')} message={t('Add tasks and complete them to see your progress here.')} />
        )}
      </Card>
      {hasData && (
        <Card>
          <SectionTitle title={t('Productivity trend')} />
          <Text style={[font.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
            {t(`Completion rate per ${period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}`)}
          </Text>
          <TrendLine
            data={data.stats.map((s) => ({ value: s.rate === null ? 0 : Math.round(s.rate * 100), label: s.bucket.label }))}
            color={colors.tasks}
            selected={selected}
            onSelect={setSelected}
          />
        </Card>
      )}
      {showConsistency && data.consistency.length > 0 && (
        <Card>
          <SectionTitle title={t('Most consistent tasks')} />
          <Text style={[font.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>{t('Daily tasks, last 30 days')}</Text>
          <View style={{ gap: spacing.md }}>
            {data.consistency.map((c, i) => (
              <View key={c.id} style={{ gap: 6 }}>
                <Row>
                  <Text style={[font.label, { color: colors.textFaint, width: 18 }]}>{i + 1}</Text>
                  <Text style={[font.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                  {c.streak > 1 && (
                    <Row gap={2}>
                      <Ionicons name="flame" size={13} color={colors.calories} />
                      <Text style={[font.caption, { color: colors.calories }]}>{c.streak}</Text>
                    </Row>
                  )}
                  <Text style={[font.label, { color: colors.text }]}>{formatPercent(c.rate)}</Text>
                </Row>
                <View style={{ marginLeft: 18 }}>
                  <ProgressBar progress={c.rate} color={colors.tasks} height={6} />
                  <Text style={[font.caption, { color: colors.textFaint, marginTop: 4 }]}>
                    {t('{a} of {b} days', { a: c.completedDays, b: c.activeDays })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

// ───────────────────────── Expenses ─────────────────────────

export function ExpenseStatsSection({ period: controlled }: { period?: Period }) {
  const { colors } = useTheme();
  const { today, settings } = useAppData();
  const { period, setPeriod, selected, setSelected } = usePeriodSelection(controlled);
  const { data } = useQuery((db) => loadExpenseStats(db, today, period, selected), [period, selected]);
  if (!data) return <Card style={{ minHeight: 320 }}>{null}</Card>;
  const money = (c: number, compact = false) => formatMoney(c, settings.currency, compact);
  const sel = data.stats[Math.min(selected, data.stats.length - 1)];
  const cmp = data.comparison;
  const change = percentChange(cmp.currentTotal, cmp.previousTotal);
  const unit = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  return (
    <>
      <Card>
        <SectionTitle title={t('Spending')} />
        {!controlled && <View style={{ marginBottom: spacing.lg }}><PeriodPicker value={period} onChange={setPeriod} accent={colors.expenses} /></View>}
        <Text style={[font.label, { color: colors.textMuted }]}>{sel.bucket.title}</Text>
        <Row style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Stat label={t('Spent')} value={money(sel.total)} color={colors.expenses} />
          <Stat label={t('Avg / day')} value={money(Math.round(sel.avgPerDay))} />
          <Stat label={t('Days logged')} value={`${sel.loggedDays}/${sel.bucket.days}`} />
        </Row>
        <TrendBars
          data={data.stats.map((s) => ({ value: s.total / 100, label: s.bucket.label }))}
          color={colors.expenses}
          selected={selected}
          onSelect={setSelected}
          formatAxis={(v) => money(Math.round(v * 100), true)}
        />
        <Hint text={t('Tap a bar to see its category breakdown')} />
      </Card>

      <Card>
        <SectionTitle title={t('By category')} />
        <Text style={[font.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>{sel.bucket.title}</Text>
        {data.breakdown.length ? (
          <Donut
            data={data.breakdown.map((b) => ({ value: b.total, color: b.color, label: categoryLabel(b.name) }))}
            centerTitle={t('Total')}
            centerValue={money(sel.total, true)}
            format={(v) => money(v)}
          />
        ) : (
          <EmptyState icon="pie-chart-outline" title={t('No spending')} message={t('Nothing recorded in this period.')} />
        )}
      </Card>

      <Card>
        <SectionTitle title={t('Compare periods')} />
        <Row style={{ alignItems: 'flex-start' }}>
          <Stat label={t(`This ${unit}`)} value={money(cmp.currentTotal)} hint={rangeHint(cmp.current.start, cmp.current.end)} color={colors.expenses} />
          <Stat label={t(`Last ${unit}`)} value={money(cmp.previousTotal)} hint={rangeHint(cmp.previous.start, cmp.previous.end)} />
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[font.caption, { color: colors.textMuted }]}>{t('Change')}</Text>
            <ChangeBadge change={change} goodWhenDown />
          </View>
        </Row>
        <Text style={[font.caption, { color: colors.textFaint, marginTop: spacing.md }]}>
          {t(`Compares the same number of elapsed days in each ${unit}.`)}
        </Text>
        <Row style={{ marginTop: spacing.lg }}>
          <Stat label={t(`Total (last {n} ${unit}s)`, { n: data.stats.length })} value={money(data.rangeTotal)} />
          <Stat label={t('Average daily')} value={money(Math.round(data.rangeAvgPerDay))} />
        </Row>
      </Card>
    </>
  );
}

function rangeHint(a: string, b: string) {
  return a === b ? formatShortDate(a) : `${formatShortDate(a)} – ${formatShortDate(b)}`;
}

// ───────────────────────── Calories ─────────────────────────

export function CalorieStatsSection({ period: controlled }: { period?: Period }) {
  const { colors } = useTheme();
  const { today, settings } = useAppData();
  const goal = settings.calorieGoal;
  const { period, setPeriod, selected, setSelected } = usePeriodSelection(controlled);
  const { data } = useQuery((db) => loadCalorieStats(db, today, period, goal), [period, goal]);
  if (!data) return <Card style={{ minHeight: 320 }}>{null}</Card>;
  const sel = data.stats[Math.min(selected, data.stats.length - 1)];
  const daily = period === 'daily';
  const value = (s: (typeof data.stats)[number]) => (daily ? s.total : Math.round(s.avgPerLoggedDay));
  const g = data.goalSummary;

  return (
    <>
      <Card>
        <SectionTitle title={t('Calories')} />
        {!controlled && <View style={{ marginBottom: spacing.lg }}><PeriodPicker value={period} onChange={setPeriod} accent={colors.calories} /></View>}
        <Text style={[font.label, { color: colors.textMuted }]}>{sel.bucket.title}</Text>
        <Row style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Stat label={daily ? t('Total') : t('Avg / logged day')} value={`${formatNumber(value(sel))}`} hint={t('kcal')} color={colors.calories} />
          <Stat label={daily ? t('vs goal') : t('Total')} value={daily ? `${formatPercent(goal ? sel.total / goal : null)}` : formatNumber(sel.total)} hint={daily ? t('{n} kcal goal', { n: formatNumber(goal) }) : t('kcal')} />
          <Stat label={t('Days logged')} value={`${sel.loggedDays}/${sel.bucket.days}`} />
        </Row>
        <TrendBars
          data={data.stats.map((s) => ({ value: value(s), label: s.bucket.label }))}
          color={colors.calories}
          selected={selected}
          onSelect={setSelected}
          goal={goal}
          formatAxis={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(v)))}
        />
        <Row gap={spacing.lg}>
          <Row gap={6}>
            <View style={{ width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.danger }} />
            <Text style={[font.caption, { color: colors.textMuted }]}>{t('Daily goal ({n} kcal)', { n: formatNumber(goal) })}</Text>
          </Row>
        </Row>
        {!daily && <Text style={[font.caption, { color: colors.textFaint, marginTop: 6 }]}>{t('Bars show the average of days with entries.')}</Text>}
        <Hint text={t('Tap a bar to see that period')} />
      </Card>
      <Card>
        <SectionTitle title={t('Goal check · last 30 days')} />
        {g.loggedDays ? (
          <>
            <Row>
              <Stat label={t('Within goal')} value={t('{n} days', { n: g.daysWithinGoal })} color={colors.success} />
              <Stat label={t('Over goal')} value={t('{n} days', { n: g.daysOverGoal })} color={g.daysOverGoal ? colors.danger : undefined} />
              <Stat label={t('Average')} value={formatNumber(g.avgPerLoggedDay)} hint={t('kcal / logged day')} />
            </Row>
            <View style={{ marginTop: spacing.lg }}>
              <ProgressBar progress={g.daysWithinGoal / g.loggedDays} color={colors.success} />
            </View>
          </>
        ) : (
          <EmptyState icon="flame-outline" title={t('No entries yet')} message={t('Log calories to compare against your goal.')} />
        )}
      </Card>
    </>
  );
}
