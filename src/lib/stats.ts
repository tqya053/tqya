/**
 * Pure statistics functions. They take plain rows (from SQLite) and return
 * chart-ready aggregates. Nothing here touches the database, so it is fully
 * unit-tested.
 */
import type { DailyTask, DailyTaskLog } from '../db/types';
import {
  addDays,
  addMonths,
  daysBetween,
  formatMonth,
  formatShortDate,
  maxKey,
  minKey,
  parseDateKey,
  rangeKeys,
  startOfMonth,
  startOfWeek,
  weekdayShort,
  type DateKey,
} from './dates';

export type Period = 'daily' | 'weekly' | 'monthly';

export const PERIOD_LABELS: Record<Period, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

/** How many buckets each period shows in charts. */
export const PERIOD_BUCKETS: Record<Period, number> = { daily: 14, weekly: 8, monthly: 6 };

export interface Bucket {
  key: string; // bucket start date
  label: string; // short axis label
  title: string; // long label for tooltips/details
  start: DateKey;
  end: DateKey; // clamped to today
  days: number; // elapsed days in bucket (>= 1)
}

/** The last `count` buckets for a period, ending with the one that contains `today`. */
export function getBuckets(period: Period, today: DateKey, count = PERIOD_BUCKETS[period]): Bucket[] {
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let start: DateKey;
    let fullEnd: DateKey;
    let label: string;
    let title: string;
    if (period === 'daily') {
      start = addDays(today, -i);
      fullEnd = start;
      label = String(parseDateKey(start).getDate());
      title = `${weekdayShort(start)}, ${formatShortDate(start)}`;
    } else if (period === 'weekly') {
      start = addDays(startOfWeek(today), -7 * i);
      fullEnd = addDays(start, 6);
      label = formatShortDate(start);
      title = `Week of ${formatShortDate(start)}`;
    } else {
      start = addMonths(startOfMonth(today), -i);
      fullEnd = addDays(addMonths(start, 1), -1);
      label = formatMonth(start);
      title = formatMonth(start, true);
    }
    const end = minKey(fullEnd, today);
    out.push({ key: start, label, title, start, end, days: daysBetween(start, end) + 1 });
  }
  return out;
}

/** The period containing `today` and the same elapsed span of the previous period. */
export function comparisonRanges(period: Period, today: DateKey) {
  const [prev, cur] = getBuckets(period, today, 2);
  const prevFullEnd =
    period === 'daily' ? prev.start : period === 'weekly' ? addDays(prev.start, 6) : addDays(cur.start, -1);
  const prevEnd = minKey(addDays(prev.start, cur.days - 1), prevFullEnd);
  return {
    current: { start: cur.start, end: cur.end, title: cur.title },
    previous: { start: prev.start, end: prevEnd, title: prev.title },
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

// ───────────────────────── Tasks ─────────────────────────

export interface TaskDay {
  date: DateKey;
  total: number;
  completed: number;
}

export function isDailyTaskActive(t: Pick<DailyTask, 'created_date' | 'archived_date'>, date: DateKey) {
  return t.created_date <= date && (t.archived_date === null || t.archived_date > date);
}

/** Per-day task totals (daily tasks active that day + one-time tasks for that day). */
export function computeTaskDays(
  dailyTasks: Pick<DailyTask, 'id' | 'created_date' | 'archived_date'>[],
  logs: Pick<DailyTaskLog, 'task_id' | 'date'>[],
  oneTimes: { date: DateKey; completed: number }[],
  dates: DateKey[],
): Map<DateKey, TaskDay> {
  const logSet = new Set(logs.map((l) => `${l.task_id}|${l.date}`));
  const map = new Map<DateKey, TaskDay>();
  for (const date of dates) {
    let total = 0;
    let completed = 0;
    for (const t of dailyTasks) {
      if (!isDailyTaskActive(t, date)) continue;
      total++;
      if (logSet.has(`${t.id}|${date}`)) completed++;
    }
    map.set(date, { date, total, completed });
  }
  for (const o of oneTimes) {
    const day = map.get(o.date);
    if (!day) continue;
    day.total++;
    if (o.completed) day.completed++;
  }
  return map;
}

export interface TaskBucketStat {
  bucket: Bucket;
  total: number;
  completed: number;
  incomplete: number;
  rate: number | null; // 0..1, null when there were no tasks
}

export function aggregateTaskBuckets(buckets: Bucket[], days: Map<DateKey, TaskDay>): TaskBucketStat[] {
  return buckets.map((bucket) => {
    let total = 0;
    let completed = 0;
    for (const d of rangeKeys(bucket.start, bucket.end)) {
      const day = days.get(d);
      if (!day) continue;
      total += day.total;
      completed += day.completed;
    }
    return { bucket, total, completed, incomplete: total - completed, rate: total ? completed / total : null };
  });
}

export interface TaskConsistency {
  id: number;
  name: string;
  activeDays: number;
  completedDays: number;
  rate: number;
  streak: number;
}

/** Completion rate of each permanent task over [start, end], best first. */
export function taskConsistency(
  dailyTasks: Pick<DailyTask, 'id' | 'name' | 'created_date' | 'archived_date'>[],
  logs: Pick<DailyTaskLog, 'task_id' | 'date'>[],
  start: DateKey,
  end: DateKey,
): TaskConsistency[] {
  const byTask = new Map<number, Set<DateKey>>();
  for (const l of logs) {
    if (!byTask.has(l.task_id)) byTask.set(l.task_id, new Set());
    byTask.get(l.task_id)!.add(l.date);
  }
  const result: TaskConsistency[] = [];
  for (const t of dailyTasks) {
    const from = maxKey(start, t.created_date);
    const to = t.archived_date ? minKey(end, addDays(t.archived_date, -1)) : end;
    if (from > to) continue;
    const done = byTask.get(t.id) ?? new Set<DateKey>();
    let completedDays = 0;
    for (const d of done) if (d >= from && d <= to) completedDays++;
    const activeDays = daysBetween(from, to) + 1;
    // Current streak: consecutive completed days ending today (or yesterday if today is still open).
    let streak = 0;
    let cursor = done.has(end) ? end : addDays(end, -1);
    while (cursor >= from && done.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    result.push({ id: t.id, name: t.name, activeDays, completedDays, rate: completedDays / activeDays, streak });
  }
  return result.sort((a, b) => b.rate - a.rate || b.completedDays - a.completedDays || a.name.localeCompare(b.name));
}

// ───────────────────────── Expenses & calories ─────────────────────────

export interface SumBucketStat {
  bucket: Bucket;
  total: number;
  loggedDays: number;
  avgPerDay: number; // total / elapsed days
  avgPerLoggedDay: number; // total / days with at least one entry
}

/** Sums per-day totals into buckets. */
export function aggregateSumBuckets(buckets: Bucket[], daily: { date: DateKey; total: number }[]): SumBucketStat[] {
  const map = new Map(daily.map((d) => [d.date, d.total]));
  return buckets.map((bucket) => {
    let total = 0;
    let loggedDays = 0;
    for (const d of rangeKeys(bucket.start, bucket.end)) {
      const v = map.get(d);
      if (v) {
        total += v;
        loggedDays++;
      }
    }
    return {
      bucket,
      total,
      loggedDays,
      avgPerDay: total / bucket.days,
      avgPerLoggedDay: loggedDays ? total / loggedDays : 0,
    };
  });
}

export interface CategorySlice {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  total: number;
  share: number; // 0..1
  count: number;
}

export function categoryBreakdown(
  rows: { category_id: number; category_name: string; category_color: string; category_icon: string; amount_cents: number }[],
): CategorySlice[] {
  const map = new Map<number, CategorySlice>();
  let sum = 0;
  for (const r of rows) {
    sum += r.amount_cents;
    const s = map.get(r.category_id) ?? {
      categoryId: r.category_id,
      name: r.category_name,
      color: r.category_color,
      icon: r.category_icon,
      total: 0,
      share: 0,
      count: 0,
    };
    s.total += r.amount_cents;
    s.count++;
    map.set(r.category_id, s);
  }
  const out = [...map.values()];
  for (const s of out) s.share = sum ? s.total / sum : 0;
  return out.sort((a, b) => b.total - a.total);
}

export interface GoalSummary {
  loggedDays: number;
  daysOverGoal: number;
  daysWithinGoal: number;
  avgPerLoggedDay: number;
}

export function calorieGoalSummary(daily: { date: DateKey; total: number }[], goal: number): GoalSummary {
  const logged = daily.filter((d) => d.total > 0);
  const over = logged.filter((d) => d.total > goal).length;
  const sum = logged.reduce((a, d) => a + d.total, 0);
  return {
    loggedDays: logged.length,
    daysOverGoal: over,
    daysWithinGoal: logged.length - over,
    avgPerLoggedDay: logged.length ? sum / logged.length : 0,
  };
}
