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
import { useI18n } from '../i18n/I18nProvider';
import { categoryLabel, t } from '../i18n/translate';
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
  const { rtl } = useI18n();
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
        style={[styles.bigText, { color, letterSpacing: rtl ? 0 : -1, direction: 'ltr' }]}
        accessibilityLabel={decimal ? t('Amount') : t('Calories')}
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
          <Text style={[font.label, { color: colors.textMuted, flex: 1 }]}>{t('Category')}</Text>
          <Pressable onPress={() => router.push('/categories')} hitSlop={8} accessibilityRole="button">
            <Text style={[font.label, { color: colors.expenses }]}>{t('Manage')}</Text>
          </Pressable>
        </Row>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={categoryLabel(c.name)}
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
          label={t('What was it for?')}
          placeholder={t('e.g. Birthday gift')}
          value={description}
          onChangeText={setDescription}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      ) : showNote ? (
        <Field label={t('Note (optional)')} placeholder={t('Add a note')} value={description} onChangeText={setDescription} maxLength={120} />
      ) : (
        <Pressable onPress={() => setShowNote(true)} hitSlop={6} accessibilityRole="button">
          <Row gap={6}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
            <Text style={[font.label, { color: colors.textMuted }]}>{t('Add note (optional)')}</Text>
          </Row>
        </Pressable>
      )}
      {existing ? <DateTimeFields date={when.date} time={when.time} today={today} onChange={setWhen} /> : null}
      <Button
        label={cents ? t('Confirm {value}', { value: formatMoney(cents, settings.currency) }) : t('Confirm')}
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
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];

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
  const [description, setDescription] = useState(existing?.description ?? '');
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
      description,
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
      if (!existing) {
        setValue('');
        setDescription('');
      }
      onDone?.();
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <BigNumberInput
        value={value}
        onChangeText={(t) => setValue(t.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5))}
        suffix={t('kcal')}
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
      <View style={{ gap: spacing.sm }}>
        <Text style={[font.label, { color: colors.textMuted }]}>{t('What did you eat? (optional)')}</Text>
        <View style={styles.chips}>
          {MEALS.map((m) => (
            <Chip
              key={m}
              label={t(m)}
              color={colors.calories}
              selected={description === t(m)}
              onPress={() => setDescription(description === t(m) ? '' : t(m))}
            />
          ))}
        </View>
        <Field placeholder={t('e.g. Chicken salad')} value={description} onChangeText={setDescription} maxLength={120} />
      </View>
      {existing ? <DateTimeFields date={when.date} time={when.time} today={today} onChange={setWhen} /> : null}
      <Button
        label={calories ? t('Confirm {value}', { value: `${calories} ${t('kcal')}` }) : t('Confirm')}
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

export type TaskEdit = { kind: 'daily' | 'once'; id: number; title: string; description?: string | null; date?: DateKey };

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
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState<DateKey>(existing?.date ?? defaultDate ?? today);
  const [saving, setSaving] = useState(false);
  const canSave = title.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const ok = await mutate(async (db) => {
      if (existing?.kind === 'daily') await renameDailyTask(db, existing.id, title, description);
      else if (existing) await updateOneTimeTask(db, existing.id, title, date, description);
      else if (kind === 'daily') await addDailyTask(db, title, today, description);
      else await addOneTimeTask(db, title, date, description);
      return true;
    });
    setSaving(false);
    if (ok) {
      haptic('success');
      if (!existing) {
        setTitle('');
        setDescription('');
      }
      onDone?.();
    }
  };

  const hint = useMemo(
    () =>
      kind === 'daily'
        ? t('Repeats every day. Completion resets automatically each morning.')
        : t('Shows only on the selected day.'),
    [kind],
  );

  return (
    <View style={{ gap: spacing.lg }}>
      {!existing && (
        <Segmented
          options={[
            { value: 'once', label: t('One-time') },
            { value: 'daily', label: t('Every day') },
          ]}
          value={kind}
          onChange={setKind}
          accent={colors.tasks}
        />
      )}
      <Field
        label={kind === 'daily' ? t('Daily task') : t('Task')}
        placeholder={kind === 'daily' ? t('e.g. Read 20 minutes') : t('e.g. Call the dentist')}
        value={title}
        onChangeText={setTitle}
        autoFocus={!existing}
        maxLength={120}
        returnKeyType="next"
      />
      <Field
        label={t('Description (optional)')}
        placeholder={t('Details, steps or notes — shown when you tap the task')}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      {kind === 'once' && <DateTimeFields date={date} today={today} onChange={(v) => setDate(v.date)} />}
      <Text style={[font.caption, { color: colors.textMuted, marginTop: -spacing.sm }]}>{hint}</Text>
      <Button
        label={existing ? t('Save changes') : t('Add task')}
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
  bigText: { fontSize: 44, fontWeight: '800', minWidth: 80, textAlign: 'center', paddingVertical: 4 },
  bigAffix: { fontSize: 24, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
