import type { DateKey } from '../lib/dates';
import type { DailyTask, DailyTaskLog, DayTask, DB, OneTimeTask } from './types';

const ACTIVE_ON = '(created_date <= ? AND (archived_date IS NULL OR archived_date > ?))';

function cleanName(name: string): string {
  const v = name.trim().replace(/\s+/g, ' ');
  if (!v) throw new Error('Task name cannot be empty');
  if (v.length > 120) throw new Error('Task name is too long');
  return v;
}

const nowIso = () => new Date().toISOString();

// ───────────────────────── Permanent daily tasks ─────────────────────────

export async function listActiveDailyTasks(db: DB, date: DateKey): Promise<DailyTask[]> {
  return db.getAllAsync<DailyTask>(
    `SELECT id, name, created_date, archived_date, sort_order FROM daily_tasks
     WHERE ${ACTIVE_ON} ORDER BY sort_order, id`,
    [date, date],
  );
}

export async function addDailyTask(db: DB, name: string, today: DateKey): Promise<number> {
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM daily_tasks', []);
  const res = await db.runAsync(
    'INSERT INTO daily_tasks (name, created_date, sort_order) VALUES (?, ?, ?)',
    [cleanName(name), today, (max?.m ?? -1) + 1],
  );
  return res.lastInsertRowId;
}

export async function renameDailyTask(db: DB, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE daily_tasks SET name = ? WHERE id = ?', [cleanName(name), id]);
}

/**
 * Removes a permanent task from today onward. Past days keep the task and its
 * completion history (soft delete). A task created today has no history, so it
 * is removed completely.
 */
export async function deleteDailyTask(db: DB, id: number, today: DateKey): Promise<void> {
  const task = await db.getFirstAsync<DailyTask>('SELECT * FROM daily_tasks WHERE id = ?', [id]);
  if (!task) return;
  if (task.created_date >= today) {
    await db.runAsync('DELETE FROM daily_task_logs WHERE task_id = ?', [id]);
    await db.runAsync('DELETE FROM daily_tasks WHERE id = ?', [id]);
  } else {
    await db.runAsync('DELETE FROM daily_task_logs WHERE task_id = ? AND date >= ?', [id, today]);
    await db.runAsync('UPDATE daily_tasks SET archived_date = ? WHERE id = ?', [today, id]);
  }
}

export async function setDailyTaskCompleted(
  db: DB,
  id: number,
  date: DateKey,
  completed: boolean,
): Promise<void> {
  if (completed) {
    await db.runAsync(
      'INSERT OR REPLACE INTO daily_task_logs (task_id, date, completed_at) VALUES (?, ?, ?)',
      [id, date, nowIso()],
    );
  } else {
    await db.runAsync('DELETE FROM daily_task_logs WHERE task_id = ? AND date = ?', [id, date]);
  }
}

// ───────────────────────── One-time tasks ─────────────────────────

export async function addOneTimeTask(db: DB, title: string, date: DateKey): Promise<number> {
  const res = await db.runAsync('INSERT INTO one_time_tasks (title, date) VALUES (?, ?)', [cleanName(title), date]);
  return res.lastInsertRowId;
}

export async function updateOneTimeTask(db: DB, id: number, title: string, date: DateKey): Promise<void> {
  await db.runAsync('UPDATE one_time_tasks SET title = ?, date = ? WHERE id = ?', [cleanName(title), date, id]);
}

export async function deleteOneTimeTask(db: DB, id: number): Promise<void> {
  await db.runAsync('DELETE FROM one_time_tasks WHERE id = ?', [id]);
}

export async function setOneTimeTaskCompleted(db: DB, id: number, completed: boolean): Promise<void> {
  await db.runAsync('UPDATE one_time_tasks SET completed = ?, completed_at = ? WHERE id = ?', [
    completed ? 1 : 0,
    completed ? nowIso() : null,
    id,
  ]);
}

export async function getOneTimeTask(db: DB, id: number): Promise<OneTimeTask | null> {
  return db.getFirstAsync<OneTimeTask>('SELECT * FROM one_time_tasks WHERE id = ?', [id]);
}

// ───────────────────────── Queries ─────────────────────────

/** Everything that should be shown on a given day. */
export async function getTasksForDay(db: DB, date: DateKey): Promise<{ daily: DayTask[]; once: DayTask[] }> {
  const daily = await db.getAllAsync<{ id: number; name: string; done: number }>(
    `SELECT t.id, t.name, (l.task_id IS NOT NULL) AS done
     FROM daily_tasks t
     LEFT JOIN daily_task_logs l ON l.task_id = t.id AND l.date = ?
     WHERE t.created_date <= ? AND (t.archived_date IS NULL OR t.archived_date > ?)
     ORDER BY t.sort_order, t.id`,
    [date, date, date],
  );
  const once = await db.getAllAsync<OneTimeTask>(
    'SELECT * FROM one_time_tasks WHERE date = ? ORDER BY completed, id',
    [date],
  );
  return {
    daily: daily.map((r) => ({ kind: 'daily', id: r.id, title: r.name, completed: !!r.done })),
    once: once.map((r) => ({ kind: 'once', id: r.id, title: r.title, completed: !!r.completed })),
  };
}

export interface TaskRangeData {
  dailyTasks: DailyTask[];
  logs: DailyTaskLog[];
  oneTimes: Pick<OneTimeTask, 'id' | 'title' | 'date' | 'completed'>[];
}

/** Raw rows needed to compute task statistics for [start, end]. */
export async function getTaskRangeData(db: DB, start: DateKey, end: DateKey): Promise<TaskRangeData> {
  const dailyTasks = await db.getAllAsync<DailyTask>(
    `SELECT id, name, created_date, archived_date, sort_order FROM daily_tasks
     WHERE created_date <= ? AND (archived_date IS NULL OR archived_date > ?)
     ORDER BY sort_order, id`,
    [end, start],
  );
  const logs = await db.getAllAsync<DailyTaskLog>(
    'SELECT task_id, date, completed_at FROM daily_task_logs WHERE date BETWEEN ? AND ?',
    [start, end],
  );
  const oneTimes = await db.getAllAsync<TaskRangeData['oneTimes'][number]>(
    'SELECT id, title, date, completed FROM one_time_tasks WHERE date BETWEEN ? AND ?',
    [start, end],
  );
  return { dailyTasks, logs, oneTimes };
}

/** Earliest date with any task data (used to bound "all time" stats). */
export async function getFirstTaskDate(db: DB): Promise<DateKey | null> {
  const row = await db.getFirstAsync<{ d: string | null }>(
    `SELECT MIN(d) AS d FROM (
       SELECT MIN(created_date) AS d FROM daily_tasks
       UNION ALL SELECT MIN(date) FROM one_time_tasks)`,
    [],
  );
  return row?.d ?? null;
}
