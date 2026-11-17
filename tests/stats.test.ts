import { addDays, daysBetween, endOfMonth, isValidDateKey, rangeKeys, startOfWeek, toDateKey } from '../src/lib/dates';
import { formatMoney, parseAmountToCents, parseCalories, sanitizeAmountInput } from '../src/lib/format';
import {
  aggregateSumBuckets,
  aggregateTaskBuckets,
  calorieGoalSummary,
  categoryBreakdown,
  comparisonRanges,
  computeTaskDays,
  getBuckets,
  percentChange,
  taskConsistency,
} from '../src/lib/stats';

describe('dates', () => {
  it('uses local calendar days and handles month/leap boundaries', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(startOfWeek('2026-03-08')).toBe('2026-03-02'); // Sunday → Monday
    expect(startOfWeek('2026-03-02')).toBe('2026-03-02');
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(rangeKeys('2026-03-30', '2026-04-02')).toEqual(['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02']);
  });

  it('is stable across a DST change (no skipped or duplicated days)', () => {
    const keys = rangeKeys('2026-03-01', '2026-04-30');
    expect(keys).toHaveLength(61);
    expect(new Set(keys).size).toBe(61);
  });
});

describe('format', () => {
  it('parses money to integer cents without float errors', () => {
    expect(parseAmountToCents('12')).toBe(1200);
    expect(parseAmountToCents('0.1')).toBe(10);
    expect(parseAmountToCents('19,99')).toBe(1999);
    expect(parseAmountToCents('1.005')).toBeNull();
    expect(parseAmountToCents('0')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(sanitizeAmountInput('0012.345')).toBe('12.34');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(formatMoney(123456, '$')).toBe('$1,234.56');
    expect(parseCalories('650')).toBe(650);
    expect(parseCalories('6.5')).toBeNull();
  });
});

describe('buckets', () => {
  const today = '2026-03-11'; // Wednesday

  it('daily buckets end today', () => {
    const b = getBuckets('daily', today);
    expect(b).toHaveLength(14);
    expect(b[13]).toMatchObject({ start: today, end: today, days: 1 });
    expect(b[0].start).toBe('2026-02-26');
  });

  it('weekly buckets start Monday and the current one is clamped to today', () => {
    const b = getBuckets('weekly', today);
    expect(b).toHaveLength(8);
    expect(b[7]).toMatchObject({ start: '2026-03-09', end: today, days: 3 });
    expect(b[6]).toMatchObject({ start: '2026-03-02', end: '2026-03-08', days: 7 });
  });

  it('monthly buckets', () => {
    const b = getBuckets('monthly', today);
    expect(b[5]).toMatchObject({ start: '2026-03-01', end: today, days: 11 });
    expect(b[4]).toMatchObject({ start: '2026-02-01', end: '2026-02-28', days: 28 });
    expect(b[0].start).toBe('2025-10-01');
  });

  it('comparison ranges compare like-for-like elapsed spans', () => {
    expect(comparisonRanges('weekly', today)).toMatchObject({
      current: { start: '2026-03-09', end: today },
      previous: { start: '2026-03-02', end: '2026-03-04' },
    });
    expect(comparisonRanges('daily', today).previous).toMatchObject({ start: '2026-03-10', end: '2026-03-10' });
    // Mar 31 vs a 28-day February is clamped to Feb 28
    expect(comparisonRanges('monthly', '2026-03-31').previous).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe('task statistics', () => {
  const tasks = [
    { id: 1, name: 'Workout', created_date: '2026-03-01', archived_date: null },
    { id: 2, name: 'Read', created_date: '2026-03-03', archived_date: '2026-03-05' }, // active 3rd & 4th
  ];
  const logs = [
    { task_id: 1, date: '2026-03-01' },
    { task_id: 1, date: '2026-03-02' },
    { task_id: 1, date: '2026-03-04' },
    { task_id: 1, date: '2026-03-05' },
    { task_id: 2, date: '2026-03-03' },
    { task_id: 2, date: '2026-03-04' },
  ];
  const once = [
    { date: '2026-03-02', completed: 1 },
    { date: '2026-03-02', completed: 0 },
  ];
  const dates = rangeKeys('2026-03-01', '2026-03-05');

  it('computes per-day completion including recurring and one-time tasks', () => {
    const days = computeTaskDays(tasks, logs, once, dates);
    expect([...days.values()].map((d) => [d.completed, d.total])).toEqual([
      [1, 1],
      [2, 3],
      [1, 2],
      [2, 2],
      [1, 1],
    ]);
  });

  it('aggregates into weekly buckets', () => {
    const days = computeTaskDays(tasks, logs, once, dates);
    const [week] = aggregateTaskBuckets(
      [{ key: 'w', label: '', title: '', start: '2026-03-01', end: '2026-03-05', days: 5 }],
      days,
    );
    expect(week).toMatchObject({ total: 9, completed: 7, incomplete: 2 });
    expect(week.rate).toBeCloseTo(7 / 9);
  });

  it('ranks consistency and computes streaks', () => {
    const c = taskConsistency(tasks, logs, '2026-03-01', '2026-03-05');
    expect(c[0]).toMatchObject({ name: 'Read', activeDays: 2, completedDays: 2, rate: 1 });
    expect(c[1]).toMatchObject({ name: 'Workout', activeDays: 5, completedDays: 4, streak: 2 });
  });

  it('a day with no tasks has no rate (not 0%)', () => {
    const days = computeTaskDays([], [], [], ['2026-03-01']);
    const [b] = aggregateTaskBuckets(
      [{ key: 'd', label: '', title: '', start: '2026-03-01', end: '2026-03-01', days: 1 }],
      days,
    );
    expect(b.rate).toBeNull();
  });
});

describe('sum statistics', () => {
  it('sums buckets with daily averages', () => {
    const daily = [
      { date: '2026-03-02', total: 1000 },
      { date: '2026-03-04', total: 500 },
      { date: '2026-03-10', total: 700 },
    ];
    const buckets = getBuckets('weekly', '2026-03-11', 2);
    const [w1, w2] = aggregateSumBuckets(buckets, daily);
    expect(w1).toMatchObject({ total: 1500, loggedDays: 2, avgPerLoggedDay: 750 });
    expect(w1.avgPerDay).toBeCloseTo(1500 / 7);
    expect(w2).toMatchObject({ total: 700, loggedDays: 1 });
    expect(w2.avgPerDay).toBeCloseTo(700 / 3);
  });

  it('category breakdown', () => {
    const rows = [
      { category_id: 1, category_name: 'Food', category_color: '#f00', category_icon: 'x', amount_cents: 300 },
      { category_id: 2, category_name: 'Gym', category_color: '#0f0', category_icon: 'x', amount_cents: 100 },
      { category_id: 1, category_name: 'Food', category_color: '#f00', category_icon: 'x', amount_cents: 600 },
    ];
    const s = categoryBreakdown(rows);
    expect(s.map((x) => [x.name, x.total, x.count])).toEqual([
      ['Food', 900, 2],
      ['Gym', 100, 1],
    ]);
    expect(s[0].share).toBeCloseTo(0.9);
  });

  it('calorie goal summary', () => {
    expect(
      calorieGoalSummary(
        [
          { date: '2026-03-01', total: 2500 },
          { date: '2026-03-02', total: 1500 },
          { date: '2026-03-03', total: 0 },
        ],
        2000,
      ),
    ).toEqual({ loggedDays: 2, daysOverGoal: 1, daysWithinGoal: 1, avgPerLoggedDay: 2000 });
  });
});
