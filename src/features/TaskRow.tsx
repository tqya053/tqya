import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic, IconButton } from '../components/ui';
import { setDailyTaskCompleted, setOneTimeTaskCompleted } from '../db/tasks';
import type { DayTask } from '../db/types';
import { useAppData } from '../hooks/useAppData';
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

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.main}
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
        {task.kind === 'daily' ? <Ionicons name="repeat" size={14} color={colors.textFaint} /> : null}
      </Pressable>
      {onMore ? <IconButton icon="ellipsis-horizontal" label={`Options for ${task.title}`} onPress={onMore} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  check: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
