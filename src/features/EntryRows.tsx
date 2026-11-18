import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Divider, Row, Sheet, type IconName } from '../components/ui';
import { deleteCalorieEntry } from '../db/calories';
import { deleteExpense } from '../db/expenses';
import type { CalorieEntry, ExpenseWithCategory } from '../db/types';
import { useAppData } from '../hooks/useAppData';
import { categoryLabel, t } from '../i18n/translate';
import { formatTime12, relativeDayLabel, type DateKey } from '../lib/dates';
import { formatMoney, formatNumber } from '../lib/format';
import { font, spacing, useTheme } from '../theme';
import { CalorieForm, ExpenseForm } from './forms';

function confirm(title: string, message: string, onYes: () => void) {
  Alert.alert(title, message, [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Delete'), style: 'destructive', onPress: onYes },
  ]);
}

export function ExpenseRow({ e, onPress }: { e: ExpenseWithCategory; onPress: () => void }) {
  const { colors } = useTheme();
  const { settings } = useAppData();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${categoryLabel(e.category_name)} ${formatMoney(e.amount_cents, settings.currency)}`}
    >
      <View style={[styles.icon, { backgroundColor: e.category_color + '22' }]}>
        <Ionicons name={e.category_icon as IconName} size={18} color={e.category_color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: colors.text }]} numberOfLines={1}>
          {e.description || categoryLabel(e.category_name)}
        </Text>
        <Text style={[font.caption, { color: colors.textMuted }]}>
          {e.description ? `${categoryLabel(e.category_name)} · ` : ''}
          {formatTime12(e.time)}
        </Text>
      </View>
      <Text style={[font.heading, { color: colors.text }]}>{formatMoney(e.amount_cents, settings.currency)}</Text>
    </Pressable>
  );
}

export function CalorieRow({ e, onPress }: { e: CalorieEntry; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${e.calories} ${t('kcal')} ${formatTime12(e.time)}`}
    >
      <View style={[styles.icon, { backgroundColor: colors.caloriesSoft }]}>
        <Ionicons name="flame" size={18} color={colors.calories} />
      </View>
      <View style={{ flex: 1 }}>
        {e.description ? (
          <Text style={[font.body, { color: colors.text }]} numberOfLines={1}>
            {e.description}
          </Text>
        ) : null}
        <Text style={[e.description ? font.caption : font.body, { color: colors.textMuted }]}>{formatTime12(e.time)}</Text>
      </View>
      <Text style={[font.heading, { color: colors.text }]}>{formatNumber(e.calories)} {t('kcal')}</Text>
    </Pressable>
  );
}

/** Groups entries by day with a header showing the day total. */
export function DayGroups<T extends { id: number; date: DateKey }>({
  items,
  total,
  renderItem,
  formatTotal,
}: {
  items: T[];
  total: (items: T[]) => number;
  renderItem: (item: T) => React.ReactNode;
  formatTotal: (v: number) => string;
}) {
  const { colors } = useTheme();
  const { today } = useAppData();
  const groups: { date: DateKey; items: T[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {groups.map((g) => (
        <View key={g.date}>
          <Row style={{ marginBottom: spacing.xs }}>
            <Text style={[font.label, { color: colors.textMuted, flex: 1 }]}>{relativeDayLabel(g.date, today)}</Text>
            <Text style={[font.label, { color: colors.text }]}>{formatTotal(total(g.items))}</Text>
          </Row>
          <Divider />
          {g.items.map((it) => (
            <View key={it.id}>{renderItem(it)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function EditExpenseSheet({ expense, onClose }: { expense: ExpenseWithCategory | null; onClose: () => void }) {
  const { mutate } = useAppData();
  return (
    <Sheet visible={!!expense} onClose={onClose} title={t('Edit expense')}>
      {expense && (
        <>
          <ExpenseForm key={expense.id} existing={expense} onDone={onClose} />
          <Button
            label={t('Delete expense')}
            icon="trash-outline"
            variant="danger"
            onPress={() =>
              confirm(t('Delete expense?'), t('This cannot be undone.'), async () => {
                await mutate((db) => deleteExpense(db, expense.id));
                onClose();
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}

export function EditCalorieSheet({ entry, onClose }: { entry: CalorieEntry | null; onClose: () => void }) {
  const { mutate } = useAppData();
  return (
    <Sheet visible={!!entry} onClose={onClose} title={t('Edit calories')}>
      {entry && (
        <>
          <CalorieForm key={entry.id} existing={entry} onDone={onClose} />
          <Button
            label={t('Delete entry')}
            icon="trash-outline"
            variant="danger"
            onPress={() =>
              confirm(t('Delete entry?'), t('This cannot be undone.'), async () => {
                await mutate((db) => deleteCalorieEntry(db, entry.id));
                onClose();
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
