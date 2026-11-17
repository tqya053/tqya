import type React from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateTimeFields } from '../components/pickers';
import { Button, Chip, Field, haptic, Row, Segmented, type IconName } from '../components/ui';
import { addCalorieEntry, updateCalorieEntry } from '../db/calories';
import { addExpense, listCategories, updateExpense } from '../db/expenses';
import { addDailyTask, addOneTimeTask, renameDailyTask, updateOneTimeTask } from '../db/tasks';
import type { CalorieEntry, ExpenseWithCategory } from '../db/types';
import { useAppData, useQuery } from '../hooks/useAppData';
import { toTimeKey, type DateKey } from '../lib/dates';
import { centsToInput, formatMoney, parseAmountToCents, parseCalories, sanitizeAmountInput } from '../lib/format';
import { font, radius, spacing, useTheme } from '../theme';

/** Large numeric input used for amount & calories (fast single-field entry). */
function BigNumberInput({
  value,
  onChangeText,
  prefix,
  suffix,
  color,
  autoFocus,
  decimal,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChangeText: (v: string) => void;
  prefix?: string;
  suffix?: string;
  color: string;
  autoFocus?: boolean;
  decimal?: boolean;
  onSubmit?: () => void;
  inputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => inputRef?.current?.focus()}
      style={[styles.bigInput, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
    >
      {prefix ? <Text style={[styles.bigAffix, { color: colors.textMuted }]}>{prefix}</Text> : null}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        style={[styles.bigText, { color }]}
        accessibilityLabel={decimal ? 'Amount' : 'Calories'}
        maxLength={12}
      />
      {suffix ? <Text style={[styles.bigAffix, { color: colors.textMuted }]}>{suffix}</Text> : null}
    </Pressable>
  );
}

// ───────────────────────── Expense ─────────────────────────

export function ExpenseForm({
  existing,
  autoFocus,
  onDone,
}: {
  existing?: ExpenseWithCategory;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const { today, settings, mutate } = useAppData();
  const { data: categories = [] } = useQuery((db) => listCategories(db), []);
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount_cents) : '');
  const [categoryId, setCategoryId] = useState<number | null>(existing?.category_id ?? null);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [showNote, setShowNote] = useState(!!existing?.description);
  const [when, setWhen] = useState<{ date: DateKey; time?: string }>({
    date: existing?.date ?? today,
    time: existing?.time ?? toTimeKey(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const category = categories.find((c) => c.id === categoryId);
  // Keep selection valid if the category list changes (e.g. deleted elsewhere)
  useEffect(() => {
    if (categoryId !== null && categories.length && !categories.some((c) => c.id === categoryId) && !existing) {
      setCategoryId(null);
    }
  }, [categories, categoryId, existing]);

  const cents = parseAmountToCents(amount);
  const needsDescription = !!category?.is_other;
  const canSave = cents !== null && !!category && (!needsDescription || description.trim().length > 0);

  const save = async () => {
    if (!canSave || saving || !category || cents === null) return;
    setSaving(true);
    const input = {
      amountCents: cents,
      categoryId: category.id,
      description: needsDescription || showNote ? description : null,
      date: existing ? when.date : today,
      time: existing ? when.time! : toTimeKey(new Date()),
    };
    const ok = await mutate(async (db) => {
      if (existing) await updateExpense(db, existing.id, input);
      else await addExpense(db, input);
      return true;
    });
    setSaving(false);
    if (ok) {
      haptic('success');
      if (!existing) {
        setAmount('');
        setDescription('');
        setShowNote(false);
        setCategoryId(null);
      }
      onDone?.();
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <BigNumberInput
        value={amount}
        onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
        prefix={settings.currency}
        color={colors.expenses}
        decimal
        autoFocus={autoFocus}
        inputRef={amountRef}
      />
      <View style={{ gap: spacing.sm }}>
        <Row>
          <Text style={[font.label, { color: colors.textMuted, flex: 1 }]}>Category</Text>
          <Pressable onPress={() => router.push('/categories')} hitSlop={8} accessibilityRole="button">
            <Text style={[font.label, { color: colors.expenses }]}>Manage</Text>
          </Pressable>
        </Row>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon as IconName}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
      </View>
      {needsDescription ? (
        <Field
          label="What was it for?"
          placeholder="e.g. Birthday gift"
          value={description}
          onChangeText={setDescription}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      ) : showNote ? (
        <Field label="Note (optional)" placeholder="Add a note" value={description} onChangeText={setDescription} maxLength={120} />
      ) : (
        <Pressable onPress={() => setShowNote(true)} hitSlop={6} accessibilityRole="button">
          <Row gap={6}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
            <Text style={[font.label, { color: colors.textMuted }]}>Add note (optional)</Text>
          </Row>
        </Pressable>
      )}
      {existing ? <DateTimeFields date={when.date} time={when.time} today={today} onChange={setWhen} /> : null}
      <Button
        label={cents ? `Confirm ${formatMoney(cents, settings.currency)}` : 'Confirm'}
        icon="checkmark"
        color={colors.expenses}
        disabled={!canSave}
        loading={saving}
        onPress={save}
      />
    </View>
  );
}

// ───────────────────────── Calories ─────────────────────────

const CALORIE_PRESETS = [100, 250, 400, 600];

export function CalorieForm({
  existing,
  autoFocus,
  onDone,
}: {
  existing?: CalorieEntry;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const { today, mutate } = useAppData();
  const [value, setValue] = useState(existing ? String(existing.calories) : '');
  const [when, setWhen] = useState<{ date: DateKey; time?: string }>({
    date: existing?.date ?? today,
    time: existing?.time ?? toTimeKey(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const calories = parseCalories(value);

  const save = async () => {
    if (!calories || saving) return;
    setSaving(true);
    const input = {
      calories,
      date: existing ? when.date : today,
      time: existing ? when.time! : toTimeKey(new Date()),
    };
    const ok = await mutate(async (db) => {
      if (existing) await updateCalorieEntry(db, existing.id, input);
      else await addCalorieEntry(db, input);
      return true;
    });
    setSaving(false);
    if (ok) {
      haptic('success');
      if (!existing) setValue('');
      onDone?.();
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <BigNumberInput
        value={value}
        onChangeText={(t) => setValue(t.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5))}
        suffix="kcal"
        color={colors.calories}
        autoFocus={autoFocus}
        onSubmit={save}
        inputRef={ref}
      />
      {!existing && (
        <View style={styles.chips}>
          {CALORIE_PRESETS.map((p) => (
            <Chip key={p} label={`${p}`} color={colors.calories} onPress={() => setValue(String(p))} selected={calories === p} />
          ))}
        </View>
      )}
      {existing ? <DateTimeFields date={when.date} time={when.time} today={today} onChange={setWhen} /> : null}
      <Button
        label={calories ? `Confirm ${calories} kcal` : 'Confirm'}
        icon="checkmark"
        color={colors.calories}
        disabled={!calories}
        loading={saving}
        onPress={save}
      />
    </View>
  );
}

// ───────────────────────── Tasks ─────────────────────────

export type TaskEdit = { kind: 'daily' | 'once'; id: number; title: string; date?: DateKey };

export function TaskForm({
  existing,
  defaultDate,
  defaultKind = 'once',
  onDone,
}: {
  existing?: TaskEdit;
  defaultDate?: DateKey;
  defaultKind?: 'daily' | 'once';
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const { today, mutate } = useAppData();
  const [kind, setKind] = useState<'daily' | 'once'>(existing?.kind ?? defaultKind);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState<DateKey>(existing?.date ?? defaultDate ?? today);
  const [saving, setSaving] = useState(false);
  const canSave = title.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const ok = await mutate(async (db) => {
      if (existing?.kind === 'daily') await renameDailyTask(db, existing.id, title);
      else if (existing) await updateOneTimeTask(db, existing.id, title, date);
      else if (kind === 'daily') await addDailyTask(db, title, today);
      else await addOneTimeTask(db, title, date);
      return true;
    });
    setSaving(false);
    if (ok) {
      haptic('success');
      if (!existing) setTitle('');
      onDone?.();
    }
  };

  const hint = useMemo(
    () =>
      kind === 'daily'
        ? 'Repeats every day. Completion resets automatically each morning.'
        : 'Shows only on the selected day.',
    [kind],
  );

  return (
    <View style={{ gap: spacing.lg }}>
      {!existing && (
        <Segmented
          options={[
            { value: 'once', label: 'One-time' },
            { value: 'daily', label: 'Every day' },
          ]}
          value={kind}
          onChange={setKind}
          accent={colors.tasks}
        />
      )}
      <Field
        label={kind === 'daily' ? 'Daily task' : 'Task'}
        placeholder={kind === 'daily' ? 'e.g. Read 20 minutes' : 'e.g. Call the dentist'}
        value={title}
        onChangeText={setTitle}
        autoFocus={!existing}
        maxLength={120}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {kind === 'once' && <DateTimeFields date={date} today={today} onChange={(v) => setDate(v.date)} />}
      <Text style={[font.caption, { color: colors.textMuted, marginTop: -spacing.sm }]}>{hint}</Text>
      <Button
        label={existing ? 'Save changes' : 'Add task'}
        icon="checkmark"
        color={colors.tasks}
        disabled={!canSave}
        loading={saving}
        onPress={save}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bigInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  bigText: { fontSize: 44, fontWeight: '800', letterSpacing: -1, minWidth: 80, textAlign: 'center', paddingVertical: 4 },
  bigAffix: { fontSize: 24, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
