import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic, IconButton } from '../components/ui';
import { setDailyTaskCompleted, setOneTimeTaskCompleted } from '../db/tasks';
import type { DayTask } from '../db/types';
import { useAppData } from '../hooks/useAppData';
import { t } from '../i18n/translate';
import type { DateKey } from '../lib/dates';
import { font, radius, spacing, useTheme } from '../theme';

export function TaskRow({
  task,
  date,
  disabled,
  onMore,
}: {
  task: DayTask;
  date: DateKey;
  disabled?: boolean;
  onMore?: () => void;
}) {
  const { colors } = useTheme();
  const { mutate } = useAppData();
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(task.completed);
  useEffect(() => {
    if (prev.current !== task.completed && task.completed) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 110, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    prev.current = task.completed;
  }, [task.completed, scale]);

  const toggle = () => {
    if (disabled) return;
    haptic(task.completed ? 'light' : 'success');
    mutate((db) =>
      task.kind === 'daily'
        ? setDailyTaskCompleted(db, task.id, date, !task.completed)
        : setOneTimeTaskCompleted(db, task.id, !task.completed),
    );
  };

  const hasDescription = !!task.description;
  return (
    <View>
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed, disabled }}
        accessibilityLabel={task.title}
      >
        <Animated.View
          style={[
            styles.check,
            {
              borderColor: task.completed ? colors.tasks : disabled ? colors.border : colors.textFaint,
              backgroundColor: task.completed ? colors.tasks : 'transparent',
              transform: [{ scale }],
            },
          ]}
        >
          {task.completed ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </Animated.View>
      </Pressable>
      {/* Tapping the title shows the description; without one it toggles the task. */}
      <Pressable
        onPress={hasDescription ? () => setOpen((o) => !o) : toggle}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={hasDescription ? t('Show description of {name}', { name: task.title }) : task.title}
        accessibilityState={{ expanded: hasDescription ? open : undefined }}
      >
        <Text
          style={[
            font.body,
            {
              flex: 1,
              color: task.completed ? colors.textMuted : colors.text,
              textDecorationLine: task.completed ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {hasDescription ? (
          <Ionicons name={open ? 'chevron-up' : 'document-text-outline'} size={15} color={colors.textMuted} />
        ) : null}
        {task.kind === 'daily' ? <Ionicons name="repeat" size={14} color={colors.textFaint} /> : null}
      </Pressable>
      {onMore ? <IconButton icon="ellipsis-horizontal" label={t('Options for {name}', { name: task.title })} onPress={onMore} /> : null}
    </View>
    {open && hasDescription ? (
      <View style={[styles.description, { backgroundColor: colors.cardAlt }]}>
        <Text style={[font.body, { color: colors.textMuted, lineHeight: 21 }]}>{task.description}</Text>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingStart: spacing.md },
  description: { marginStart: 38, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.sm },
  check: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
