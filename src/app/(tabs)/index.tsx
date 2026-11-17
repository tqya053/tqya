import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  FadeIn,
  IconButton,
  ProgressBar,
  ProgressRing,
  Row,
  Screen,
  SectionTitle,
  Sheet,
  type IconName,
} from '../../components/ui';
import { CalorieForm, ExpenseForm, TaskForm } from '../../features/forms';
import { loadDashboard } from '../../features/queries';
import { TaskRow } from '../../features/TaskRow';
import { useAppData, useQuery } from '../../hooks/useAppData';
import { formatLongDate } from '../../lib/dates';
import { formatMoney, formatNumber, formatPercent } from '../../lib/format';
import { font, radius, spacing, useTheme } from '../../theme';

type QuickSheet = 'expense' | 'calories' | 'task' | null;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function QuickAction({ icon, label, color, soft, onPress }: { icon: IconName; label: string; color: string; soft: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quick, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[font.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { today, settings } = useAppData();
  const { data } = useQuery((db) => loadDashboard(db, today), []);
  const [sheet, setSheet] = useState<QuickSheet>(null);
  const close = () => setSheet(null);

  const goal = settings.calorieGoal;
  const money = (c: number) => formatMoney(c, settings.currency);

  const summary = (() => {
    if (!data) return '';
    const parts: string[] = [];
    if (data.total === 0) parts.push('No tasks planned yet');
    else if (data.done === data.total) parts.push(`All ${data.total} tasks done — great work`);
    else parts.push(`${data.done} of ${data.total} tasks done, ${data.total - data.done} to go`);
    parts.push(data.expenseCents ? `${money(data.expenseCents)} spent` : 'nothing spent');
    if (data.calories === 0) parts.push('no calories logged');
    else if (data.calories <= goal) parts.push(`${formatNumber(goal - data.calories)} kcal left of your goal`);
    else parts.push(`${formatNumber(data.calories - goal)} kcal over your goal`);
    return parts.join(' · ') + '.';
  })();

  const allTasks = data ? [...data.tasks.daily, ...data.tasks.once] : [];
  const pending = allTasks.filter((t) => !t.completed);
  const preview = [...pending, ...allTasks.filter((t) => t.completed)].slice(0, 6);

  return (
    <Screen
      title={greeting()}
      subtitle={formatLongDate(today)}
      right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} filled />}
    >
      {data && (
        <>
          <FadeIn>
            <Card>
              <Row gap={spacing.xl}>
                <ProgressRing progress={data.rate ?? 0} color={colors.tasks} size={116} stroke={12}>
                  <Text style={[font.title, { color: colors.text }]}>{formatPercent(data.rate)}</Text>
                  <Text style={[font.caption, { color: colors.textMuted }]}>done</Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: spacing.md }}>
                  <Text style={[font.heading, { color: colors.text }]}>Today’s tasks</Text>
                  <Row gap={spacing.lg}>
                    <View>
                      <Text style={[font.title, { color: colors.tasks }]}>{data.done}</Text>
                      <Text style={[font.caption, { color: colors.textMuted }]}>completed</Text>
                    </View>
                    <View>
                      <Text style={[font.title, { color: colors.text }]}>{data.total - data.done}</Text>
                      <Text style={[font.caption, { color: colors.textMuted }]}>remaining</Text>
                    </View>
                  </Row>
                  <Text style={[font.caption, { color: colors.textFaint }]}>This week: {formatPercent(data.weekRate)} completed</Text>
                </View>
              </Row>
            </Card>
          </FadeIn>

          <FadeIn delay={60}>
            <Row gap={spacing.md} style={{ alignItems: 'stretch' }}>
              <Pressable style={{ flex: 1 }} onPress={() => router.navigate('/expenses')} accessibilityRole="button" accessibilityLabel="Open expenses">
                <Card style={{ flex: 1, gap: spacing.sm }}>
                  <Row gap={8}>
                    <View style={[styles.dot, { backgroundColor: colors.expensesSoft }]}>
                      <Ionicons name="wallet" size={15} color={colors.expenses} />
                    </View>
                    <Text style={[font.label, { color: colors.textMuted }]}>Spent today</Text>
                  </Row>
                  <Text style={[font.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {money(data.expenseCents)}
                  </Text>
                  <Text style={[font.caption, { color: colors.textFaint }]}>Yesterday {money(data.expenseYesterdayCents)}</Text>
                </Card>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => router.navigate('/calories')} accessibilityRole="button" accessibilityLabel="Open calories">
                <Card style={{ flex: 1, gap: spacing.sm }}>
                  <Row gap={8}>
                    <View style={[styles.dot, { backgroundColor: colors.caloriesSoft }]}>
                      <Ionicons name="flame" size={15} color={colors.calories} />
                    </View>
                    <Text style={[font.label, { color: colors.textMuted }]}>Calories</Text>
                  </Row>
                  <Text style={[font.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatNumber(data.calories)}
                    <Text style={[font.label, { color: colors.textMuted }]}> / {formatNumber(goal)}</Text>
                  </Text>
                  <ProgressBar progress={data.calories / goal} color={data.calories > goal ? colors.danger : colors.calories} height={6} />
                </Card>
              </Pressable>
            </Row>
          </FadeIn>

          <FadeIn delay={120}>
            <Row gap={spacing.md}>
              <QuickAction icon="add" label="Expense" color={colors.expenses} soft={colors.expensesSoft} onPress={() => setSheet('expense')} />
              <QuickAction icon="flame-outline" label="Calories" color={colors.calories} soft={colors.caloriesSoft} onPress={() => setSheet('calories')} />
              <QuickAction icon="checkbox-outline" label="Task" color={colors.tasks} soft={colors.tasksSoft} onPress={() => setSheet('task')} />
            </Row>
          </FadeIn>

          <FadeIn delay={180}>
            <Card>
              <Row gap={8} style={{ marginBottom: spacing.sm }}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text style={[font.heading, { color: colors.text }]}>Today’s summary</Text>
              </Row>
              <Text style={[font.body, { color: colors.textMuted, lineHeight: 22 }]}>{summary}</Text>
            </Card>
          </FadeIn>

          <FadeIn delay={240}>
            <Card>
              <SectionTitle
                title="Up next"
                right={
                  <Pressable onPress={() => router.navigate('/tasks')} hitSlop={8} accessibilityRole="button">
                    <Text style={[font.label, { color: colors.tasks }]}>All tasks</Text>
                  </Pressable>
                }
              />
              {preview.length ? (
                preview.map((t) => <TaskRow key={`${t.kind}-${t.id}`} task={t} date={today} />)
              ) : (
                <EmptyState icon="checkbox-outline" title="Nothing planned" message="Add a daily habit or a one-time task." />
              )}
            </Card>
          </FadeIn>
        </>
      )}

      <Sheet visible={sheet === 'expense'} onClose={close} title="Add expense">
        <ExpenseForm autoFocus onDone={close} />
      </Sheet>
      <Sheet visible={sheet === 'calories'} onClose={close} title="Add calories">
        <CalorieForm autoFocus onDone={close} />
      </Sheet>
      <Sheet visible={sheet === 'task'} onClose={close} title="Add task">
        <TaskForm onDone={close} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
