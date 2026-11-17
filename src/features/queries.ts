/** Screen-level read models that combine repository queries with pure stats. */
import { getCalorieTotalsByDay } from '../db/calories';
import { getExpenseTotalsByDay, listExpenses } from '../db/expenses';
import { getTaskRangeData, getTasksForDay } from '../db/tasks';
import type { DB } from '../db/types';
import { addDays, rangeKeys, startOfMonth, startOfWeek, type DateKey } from '../lib/dates';
import {
  aggregateSumBuckets,
  aggregateTaskBuckets,
  calorieGoalSummary,
  categoryBreakdown,
  comparisonRanges,
  computeTaskDays,
  getBuckets,
  taskConsistency,
  type Period,
} from '../lib/stats';

export async function loadDashboard(db: DB, today: DateKey) {
  const tasks = await getTasksForDay(db, today);
  const all = [...tasks.daily, ...tasks.once];
  const done = all.filter((t) => t.completed).length;
  const [exp] = await getExpenseTotalsByDay(db, today, today);
  const [cal] = await getCalorieTotalsByDay(db, today, today);
  const yesterday = addDays(today, -1);
  const [expY] = await getExpenseTotalsByDay(db, yesterday, yesterday);
  const week = await loadTaskRates(db, today);
  return {
    tasks,
    total: all.length,
    done,
    rate: all.length ? done / all.length : null,
    expenseCents: exp?.total_cents ?? 0,
    expenseYesterdayCents: expY?.total_cents ?? 0,
    calories: cal?.total ?? 0,
    weekRate: week.weekly,
  };
}

/** Completion rate for today, this week and this month. */
export async function loadTaskRates(db: DB, today: DateKey) {
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today);
  const start = monthStart < weekStart ? monthStart : weekStart;
  const r = await getTaskRangeData(db, start, today);
  const days = computeTaskDays(r.dailyTasks, r.logs, r.oneTimes, rangeKeys(start, today));
  const rate = (from: DateKey) => {
    let total = 0;
    let done = 0;
    for (const d of rangeKeys(from, today)) {
      total += days.get(d)?.total ?? 0;
      done += days.get(d)?.completed ?? 0;
    }
    return total ? done / total : null;
  };
  return { daily: rate(today), weekly: rate(weekStart), monthly: rate(monthStart) };
}

export async function loadTaskStats(db: DB, today: DateKey, period: Period) {
  const buckets = getBuckets(period, today);
  const start = buckets[0].start;
  const r = await getTaskRangeData(db, start, today);
  const days = computeTaskDays(r.dailyTasks, r.logs, r.oneTimes, rangeKeys(start, today));
  const stats = aggregateTaskBuckets(buckets, days);
  const consistencyStart = addDays(today, -29);
  const cr = await getTaskRangeData(db, consistencyStart, today);
  const consistency = taskConsistency(cr.dailyTasks, cr.logs, consistencyStart, today);
  return { stats, consistency };
}

export async function loadExpenseStats(db: DB, today: DateKey, period: Period, selected: number) {
  const buckets = getBuckets(period, today);
  const start = buckets[0].start;
  const daily = (await getExpenseTotalsByDay(db, start, today)).map((d) => ({ date: d.date, total: d.total_cents }));
  const stats = aggregateSumBuckets(buckets, daily);
  const sel = stats[Math.min(selected, stats.length - 1)];
  const rows = await listExpenses(db, sel.bucket.start, sel.bucket.end);
  const breakdown = categoryBreakdown(rows);
  const rangeTotal = stats.reduce((a, s) => a + s.total, 0);
  const rangeDays = stats.reduce((a, s) => a + s.bucket.days, 0);
  const cmp = comparisonRanges(period, today);
  const sum = async (a: DateKey, b: DateKey) =>
    (await getExpenseTotalsByDay(db, a, b)).reduce((acc, d) => acc + d.total_cents, 0);
  return {
    stats,
    breakdown,
    rangeTotal,
    rangeAvgPerDay: rangeDays ? rangeTotal / rangeDays : 0,
    comparison: {
      ...cmp,
      currentTotal: await sum(cmp.current.start, cmp.current.end),
      previousTotal: await sum(cmp.previous.start, cmp.previous.end),
    },
  };
}

export async function loadCalorieStats(db: DB, today: DateKey, period: Period, goal: number) {
  const buckets = getBuckets(period, today);
  const start = buckets[0].start;
  const daily = await getCalorieTotalsByDay(db, start, today);
  const stats = aggregateSumBuckets(buckets, daily);
  const last30 = await getCalorieTotalsByDay(db, addDays(today, -29), today);
  return { stats, goalSummary: calorieGoalSummary(last30, goal) };
}
