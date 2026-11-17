import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, EmptyState, FadeIn, Row, Screen, SectionTitle, Segmented, Stat } from '../../components/ui';
import { listExpenses } from '../../db/expenses';
import type { ExpenseWithCategory } from '../../db/types';
import { DayGroups, EditExpenseSheet, ExpenseRow } from '../../features/EntryRows';
import { ExpenseForm } from '../../features/forms';
import { HistoryFilter, rangeBounds, useHistoryRange } from '../../features/HistoryFilter';
import { ExpenseStatsSection } from '../../features/statsSections';
import { useAppData, useQuery } from '../../hooks/useAppData';
import { formatMoney } from '../../lib/format';
import { font, spacing, useTheme } from '../../theme';

const PAGE = 100;

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const { today, settings } = useAppData();
  const [tab, setTab] = useState<'add' | 'history' | 'stats'>('add');
  const [editing, setEditing] = useState<ExpenseWithCategory | null>(null);
  const [range, setRange] = useHistoryRange();
  const [limit, setLimit] = useState(PAGE);
  const money = (c: number) => formatMoney(c, settings.currency);

  const { data: todays = [] } = useQuery((db) => listExpenses(db, today, today), []);
  const bounds = rangeBounds(range, today);
  const { data: history = [] } = useQuery(
    (db) => (tab === 'history' ? listExpenses(db, bounds.start, bounds.end) : Promise.resolve([])),
    [tab, bounds.start, bounds.end],
  );
  const todayTotal = todays.reduce((a, e) => a + e.amount_cents, 0);
  const historyTotal = history.reduce((a, e) => a + e.amount_cents, 0);
  const historyDays = new Set(history.map((e) => e.date)).size;

  return (
    <Screen title="Expenses" subtitle={`Today ${money(todayTotal)}`}>
      <Segmented
        options={[
          { value: 'add', label: 'Add' },
          { value: 'history', label: 'History' },
          { value: 'stats', label: 'Insights' },
        ]}
        value={tab}
        onChange={setTab}
        accent={colors.expenses}
      />

      {tab === 'add' && (
        <>
          <FadeIn>
            <Card>
              <ExpenseForm />
            </Card>
          </FadeIn>
          <Card>
            <SectionTitle title="Today" right={<Text style={[font.heading, { color: colors.expenses }]}>{money(todayTotal)}</Text>} />
            {todays.length ? (
              todays.map((e) => <ExpenseRow key={e.id} e={e} onPress={() => setEditing(e)} />)
            ) : (
              <EmptyState icon="wallet-outline" title="No expenses today" message="Enter an amount, pick a category, confirm." />
            )}
          </Card>
        </>
      )}

      {tab === 'history' && (
        <>
          <HistoryFilter
            value={range}
            onChange={(r) => {
              setRange(r);
              setLimit(PAGE);
            }}
            color={colors.expenses}
            today={today}
          />
          <Card>
            <Row>
              <Stat label="Total" value={money(historyTotal)} color={colors.expenses} />
              <Stat label="Entries" value={String(history.length)} />
              <Stat label="Avg / day" value={historyDays ? money(Math.round(historyTotal / historyDays)) : '—'} hint="days with spending" />
            </Row>
          </Card>
          <Card>
            {history.length ? (
              <DayGroups
                items={history.slice(0, limit)}
                total={(items) => items.reduce((a, e) => a + e.amount_cents, 0)}
                formatTotal={money}
                renderItem={(e) => <ExpenseRow e={e} onPress={() => setEditing(e)} />}
              />
            ) : (
              <EmptyState icon="receipt-outline" title="No expenses" message="Nothing recorded for this filter." />
            )}
            {history.length > limit && (
              <Button
                label={`Show more (${history.length - limit})`}
                variant="secondary"
                onPress={() => setLimit(limit + PAGE)}
                style={{ marginTop: spacing.lg }}
              />
            )}
          </Card>
        </>
      )}

      {tab === 'stats' && <ExpenseStatsSection />}

      <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
