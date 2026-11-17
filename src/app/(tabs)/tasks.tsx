import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { pickDate } from '../../components/pickers';
import { Button, Card, EmptyState, FadeIn, IconButton, ProgressBar, Row, Screen, SectionTitle, Segmented, Sheet } from '../../components/ui';
import { deleteDailyTask, deleteOneTimeTask } from '../../db/tasks';
import { getTasksForDay } from '../../db/tasks';
import type { DayTask } from '../../db/types';
import { TaskForm, type TaskEdit } from '../../features/forms';
import { TaskStatsSection } from '../../features/statsSections';
import { TaskRow } from '../../features/TaskRow';
import { useAppData, useQuery } from '../../hooks/useAppData';
import { addDays, relativeDayLabel, type DateKey } from '../../lib/dates';
import { formatPercent } from '../../lib/format';
import { font, spacing, useTheme } from '../../theme';

export default function TasksScreen() {
  const { colors } = useTheme();
  const { today, mutate } = useAppData();
  const [tab, setTab] = useState<'list' | 'stats'>('list');
  const [date, setDate] = useState<DateKey>(today);
  const [adding, setAdding] = useState<null | 'daily' | 'once'>(null);
  const [editing, setEditing] = useState<TaskEdit | null>(null);
  const [options, setOptions] = useState<DayTask | null>(null);
  const { data } = useQuery((db) => getTasksForDay(db, date), [date]);

  const isFuture = date > today;
  const all = data ? [...(isFuture ? [] : data.daily), ...data.once] : [];
  const done = all.filter((t) => t.completed).length;

  const confirmDelete = (t: DayTask) => {
    setOptions(null);
    Alert.alert(
      'Delete task?',
      t.kind === 'daily'
        ? `"${t.title}" will stop appearing from today. Past completion history is kept.`
        : `"${t.title}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => mutate((db) => (t.kind === 'daily' ? deleteDailyTask(db, t.id, today) : deleteOneTimeTask(db, t.id))),
        },
      ],
    );
  };

  return (
    <Screen title="Tasks" subtitle="Habits & to-dos">
      <Segmented
        options={[
          { value: 'list', label: 'To-do' },
          { value: 'stats', label: 'Insights' },
        ]}
        value={tab}
        onChange={setTab}
        accent={colors.tasks}
      />

      {tab === 'stats' ? (
        <TaskStatsSection />
      ) : (
        <>
          <Card style={{ gap: spacing.md }}>
            <Row>
              <IconButton icon="chevron-back" label="Previous day" onPress={() => setDate(addDays(date, -1))} filled />
              <Pressable
                style={{ flex: 1, alignItems: 'center' }}
                onPress={async () => {
                  const d = await pickDate(date);
                  if (d) setDate(d);
                }}
                accessibilityRole="button"
                accessibilityLabel="Choose date"
              >
                <Text style={[font.heading, { color: colors.text }]}>{relativeDayLabel(date, today)}</Text>
                <Text style={[font.caption, { color: colors.textMuted }]}>
                  {all.length ? `${done}/${all.length} done · ${formatPercent(done / all.length)}` : 'No tasks'}
                </Text>
              </Pressable>
              <IconButton icon="chevron-forward" label="Next day" onPress={() => setDate(addDays(date, 1))} filled />
            </Row>
            <ProgressBar progress={all.length ? done / all.length : 0} color={colors.tasks} />
            {date !== today && (
              <Pressable onPress={() => setDate(today)} style={{ alignSelf: 'center' }} accessibilityRole="button">
                <Text style={[font.label, { color: colors.tasks }]}>Jump to today</Text>
              </Pressable>
            )}
          </Card>

          <FadeIn key={`d-${date}`}>
            <Card>
              <SectionTitle
                title="Every day"
                right={<IconButton icon="add" label="Add daily task" onPress={() => setAdding('daily')} color={colors.tasks} filled />}
              />
              {isFuture ? (
                <Text style={[font.body, { color: colors.textMuted }]}>
                  Your {data?.daily.length ?? 0} daily tasks will appear here on {relativeDayLabel(date, today)}.
                </Text>
              ) : data?.daily.length ? (
                data.daily.map((t) => <TaskRow key={t.id} task={t} date={date} onMore={() => setOptions(t)} />)
              ) : (
                <EmptyState
                  icon="repeat"
                  title="No daily tasks"
                  message="Daily tasks repeat every day, e.g. Workout, Read 20 minutes, Drink water."
                />
              )}
            </Card>
          </FadeIn>

          <FadeIn key={`o-${date}`} delay={60}>
            <Card>
              <SectionTitle
                title={`One-time · ${relativeDayLabel(date, today)}`}
                right={<IconButton icon="add" label="Add one-time task" onPress={() => setAdding('once')} color={colors.tasks} filled />}
              />
              {data?.once.length ? (
                data.once.map((t) => <TaskRow key={t.id} task={t} date={date} onMore={() => setOptions(t)} />)
              ) : (
                <EmptyState icon="calendar-outline" title="Nothing for this day" message="Add a task that only shows on this date." />
              )}
            </Card>
          </FadeIn>

          <Button label="Add task" icon="add" color={colors.tasks} onPress={() => setAdding('once')} />
        </>
      )}

      <Sheet visible={adding !== null} onClose={() => setAdding(null)} title="New task">
        {adding && <TaskForm defaultKind={adding} defaultDate={date < today ? today : date} onDone={() => setAdding(null)} />}
      </Sheet>
      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing?.kind === 'daily' ? 'Edit daily task' : 'Edit task'}>
        {editing && <TaskForm existing={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet visible={options !== null} onClose={() => setOptions(null)} title={options?.title ?? ''}>
        {options && (
          <View style={{ gap: spacing.md }}>
            <Row gap={8}>
              <Ionicons name={options.kind === 'daily' ? 'repeat' : 'calendar-outline'} size={16} color={colors.textMuted} />
              <Text style={[font.body, { color: colors.textMuted }]}>
                {options.kind === 'daily' ? 'Repeats every day' : `One-time task · ${relativeDayLabel(date, today)}`}
              </Text>
            </Row>
            <Button
              label="Edit"
              icon="create-outline"
              variant="secondary"
              onPress={() => {
                setEditing({ kind: options.kind, id: options.id, title: options.title, date });
                setOptions(null);
              }}
            />
            <Button label="Delete" icon="trash-outline" variant="danger" onPress={() => confirmDelete(options)} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
