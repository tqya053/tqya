import fs from 'fs';
import os from 'os';
import path from 'path';
import { exportData, importData, resetAllData, validateBackup } from '../src/db/backup';
import { addCalorieEntry, deleteCalorieEntry, getCalorieTotalsByDay, listCalorieEntries, updateCalorieEntry } from '../src/db/calories';
import {
  addCategory,
  addExpense,
  deleteCategory,
  deleteExpense,
  getExpenseTotalsByDay,
  listCategories,
  listExpenses,
  renameCategory,
  updateExpense,
} from '../src/db/expenses';
import { migrate, SCHEMA_VERSION } from '../src/db/schema';
import { getSettings, setSetting } from '../src/db/settings';
import {
  addDailyTask,
  addOneTimeTask,
  deleteDailyTask,
  deleteOneTimeTask,
  getTaskRangeData,
  getTasksForDay,
  renameDailyTask,
  setDailyTaskCompleted,
  setOneTimeTaskCompleted,
  updateOneTimeTask,
} from '../src/db/tasks';
import { rangeKeys } from '../src/lib/dates';
import { computeTaskDays } from '../src/lib/stats';
import { openTestDb, type TestDB } from './nodeDb';

let db: TestDB;
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
});
afterEach(() => db.close());

const D1 = '2026-03-01';
const D2 = '2026-03-02';
const D3 = '2026-03-03';

describe('schema', () => {
  it('migrates to the latest version and seeds the 8 default categories', async () => {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(v?.user_version).toBe(SCHEMA_VERSION);
    const cats = await listCategories(db);
    expect(cats.map((c) => c.name)).toEqual([
      'Transportation', 'Gym', 'Coffee', 'Food', 'Dental', 'Shopping', 'Entertainment', 'Other',
    ]);
    expect(cats.find((c) => c.name === 'Other')?.is_other).toBe(1);
  });

  it('is idempotent (re-running migrate does not duplicate defaults)', async () => {
    await migrate(db);
    expect(await listCategories(db)).toHaveLength(8);
  });
});

describe('permanent daily tasks', () => {
  it('appear every day from creation and completion resets each new day', async () => {
    const id = await addDailyTask(db, '  Workout ', D1);
    await setDailyTaskCompleted(db, id, D1, true);

    const day1 = await getTasksForDay(db, D1);
    expect(day1.daily).toEqual([{ kind: 'daily', id, title: 'Workout', completed: true }]);
    // Next day: same task appears, not completed (automatic reset)
    const day2 = await getTasksForDay(db, D2);
    expect(day2.daily).toEqual([{ kind: 'daily', id, title: 'Workout', completed: false }]);
    // Not shown before it was created
    expect((await getTasksForDay(db, '2026-02-28')).daily).toHaveLength(0);
    // History of day 1 is untouched by day 2
    await setDailyTaskCompleted(db, id, D2, true);
    await setDailyTaskCompleted(db, id, D2, false);
    expect((await getTasksForDay(db, D1)).daily[0].completed).toBe(true);
  });

  it('marking complete twice is safe and unmarking removes only that day', async () => {
    const id = await addDailyTask(db, 'Read', D1);
    await setDailyTaskCompleted(db, id, D1, true);
    await setDailyTaskCompleted(db, id, D1, true);
    await setDailyTaskCompleted(db, id, D2, true);
    const logs = await db.getAllAsync('SELECT * FROM daily_task_logs', []);
    expect(logs).toHaveLength(2);
  });

  it('rename and validation', async () => {
    const id = await addDailyTask(db, 'Read', D1);
    await renameDailyTask(db, id, 'Read 20 minutes');
    expect((await getTasksForDay(db, D1)).daily[0].title).toBe('Read 20 minutes');
    await expect(addDailyTask(db, '   ', D1)).rejects.toThrow('empty');
  });

  it('deleting keeps past history but removes it from today on', async () => {
    const id = await addDailyTask(db, 'Water', D1);
    await setDailyTaskCompleted(db, id, D1, true);
    await setDailyTaskCompleted(db, id, D3, true);
    await deleteDailyTask(db, id, D3);
    expect((await getTasksForDay(db, D1)).daily).toHaveLength(1);
    expect((await getTasksForDay(db, D1)).daily[0].completed).toBe(true);
    expect((await getTasksForDay(db, D2)).daily).toHaveLength(1);
    expect((await getTasksForDay(db, D3)).daily).toHaveLength(0);
    // stats for the past still count it, not for D3
    const r = await getTaskRangeData(db, D1, D3);
    const days = computeTaskDays(r.dailyTasks, r.logs, r.oneTimes, rangeKeys(D1, D3));
    expect(days.get(D1)).toEqual({ date: D1, total: 1, completed: 1 });
    expect(days.get(D2)).toEqual({ date: D2, total: 1, completed: 0 });
    expect(days.get(D3)).toEqual({ date: D3, total: 0, completed: 0 });
  });

  it('deleting a task created today removes it entirely', async () => {
    const id = await addDailyTask(db, 'Oops', D2);
    await setDailyTaskCompleted(db, id, D2, true);
    await deleteDailyTask(db, id, D2);
    expect(await db.getAllAsync('SELECT * FROM daily_tasks', [])).toHaveLength(0);
    expect(await db.getAllAsync('SELECT * FROM daily_task_logs', [])).toHaveLength(0);
  });
});

describe('one-time tasks', () => {
  it('only appear on their date; edit, move, complete, delete', async () => {
    const id = await addOneTimeTask(db, 'Dentist', D2);
    expect((await getTasksForDay(db, D1)).once).toHaveLength(0);
    expect((await getTasksForDay(db, D2)).once[0]).toMatchObject({ id, title: 'Dentist', completed: false });

    await setOneTimeTaskCompleted(db, id, true);
    expect((await getTasksForDay(db, D2)).once[0].completed).toBe(true);

    await updateOneTimeTask(db, id, 'Dentist 3pm', D3);
    expect((await getTasksForDay(db, D2)).once).toHaveLength(0);
    expect((await getTasksForDay(db, D3)).once[0]).toMatchObject({ title: 'Dentist 3pm', completed: true });

    await deleteOneTimeTask(db, id);
    expect((await getTasksForDay(db, D3)).once).toHaveLength(0);
  });
});

describe('expense categories', () => {
  it('add, rename, prevent duplicates, delete unused', async () => {
    const id = await addCategory(db, 'Books');
    expect((await listCategories(db)).some((c) => c.id === id && c.name === 'Books')).toBe(true);
    await expect(addCategory(db, 'books')).rejects.toThrow('already exists');
    await renameCategory(db, id, 'Books & Comics');
    await expect(renameCategory(db, id, 'coffee')).rejects.toThrow('already exists');
    expect(await deleteCategory(db, id)).toBe('deleted');
    expect((await listCategories(db, true)).some((c) => c.id === id)).toBe(false);
  });

  it('archives a used category so history keeps its name, and restores on re-add', async () => {
    const id = await addCategory(db, 'Pets');
    await addExpense(db, { amountCents: 500, categoryId: id, date: D1, time: '10:00' });
    expect(await deleteCategory(db, id)).toBe('archived');
    expect((await listCategories(db)).some((c) => c.id === id)).toBe(false);
    expect((await listExpenses(db))[0].category_name).toBe('Pets');
    expect(await addCategory(db, 'pets')).toBe(id);
    expect((await listCategories(db)).some((c) => c.id === id)).toBe(true);
  });

  it('"Other" cannot be deleted', async () => {
    const other = (await listCategories(db)).find((c) => c.is_other)!;
    await expect(deleteCategory(db, other.id)).rejects.toThrow('cannot be deleted');
  });
});

describe('expenses', () => {
  it('CRUD, daily totals, Other requires a description', async () => {
    const cats = await listCategories(db);
    const coffee = cats.find((c) => c.name === 'Coffee')!;
    const other = cats.find((c) => c.is_other)!;

    const a = await addExpense(db, { amountCents: 450, categoryId: coffee.id, date: D1, time: '08:15' });
    await addExpense(db, { amountCents: 1000, categoryId: coffee.id, date: D1, time: '15:00', description: ' ' });
    await expect(addExpense(db, { amountCents: 100, categoryId: other.id, date: D1, time: '09:00' })).rejects.toThrow(
      'Describe',
    );
    await addExpense(db, { amountCents: 2599, categoryId: other.id, date: D2, time: '09:00', description: 'Gift' });
    await expect(addExpense(db, { amountCents: 0, categoryId: coffee.id, date: D1, time: '09:00' })).rejects.toThrow();
    await expect(addExpense(db, { amountCents: 10, categoryId: coffee.id, date: '2026-02-30', time: '09:00' })).rejects.toThrow('date');

    expect(await getExpenseTotalsByDay(db, D1, D3)).toEqual([
      { date: D1, total_cents: 1450 },
      { date: D2, total_cents: 2599 },
    ]);
    const all = await listExpenses(db);
    expect(all.map((e) => e.amount_cents)).toEqual([2599, 1000, 450]); // newest first
    expect(all[0]).toMatchObject({ category_name: 'Other', description: 'Gift', time: '09:00' });
    expect(all[1].description).toBeNull();

    await updateExpense(db, a, { amountCents: 500, categoryId: coffee.id, date: D2, time: '08:15', description: 'Latte' });
    expect(await getExpenseTotalsByDay(db, D1, D3)).toEqual([
      { date: D1, total_cents: 1000 },
      { date: D2, total_cents: 3099 },
    ]);
    await deleteExpense(db, a);
    expect(await listExpenses(db, D2, D2)).toHaveLength(1);
  });
});

describe('calories & settings', () => {
  it('CRUD and daily totals', async () => {
    const a = await addCalorieEntry(db, { calories: 500, date: D1, time: '08:00' });
    await addCalorieEntry(db, { calories: 700, date: D1, time: '13:00' });
    await addCalorieEntry(db, { calories: 300, date: D2, time: '13:00' });
    await expect(addCalorieEntry(db, { calories: -5, date: D1, time: '13:00' })).rejects.toThrow();
    expect(await getCalorieTotalsByDay(db, D1, D2)).toEqual([
      { date: D1, total: 1200 },
      { date: D2, total: 300 },
    ]);
    await updateCalorieEntry(db, a, { calories: 400, date: D2, time: '07:30' });
    expect(await getCalorieTotalsByDay(db, D1, D2)).toEqual([
      { date: D1, total: 700 },
      { date: D2, total: 700 },
    ]);
    await deleteCalorieEntry(db, a);
    expect(await listCalorieEntries(db, D2, D2)).toHaveLength(1);
  });

  it('settings defaults and updates', async () => {
    expect(await getSettings(db)).toEqual({ calorieGoal: 2000, currency: '$', theme: 'system', language: 'system' });
    await setSetting(db, 'calorieGoal', 1800);
    await setSetting(db, 'theme', 'dark');
    await setSetting(db, 'currency', '€');
    await setSetting(db, 'language', 'ar');
    expect(await getSettings(db)).toEqual({ calorieGoal: 1800, currency: '€', theme: 'dark', language: 'ar' });
    await expect(setSetting(db, 'calorieGoal', 0)).rejects.toThrow();
  });
});

async function populate(target: TestDB) {
  const t = await addDailyTask(target, 'Workout', D1);
  await setDailyTaskCompleted(target, t, D1, true);
  await addOneTimeTask(target, 'Call mom', D2);
  const cat = await addCategory(target, 'Books');
  await addExpense(target, { amountCents: 1234, categoryId: cat, date: D1, time: '12:00', description: 'Novel' });
  await addCalorieEntry(target, { calories: 650, date: D1, time: '12:30' });
  await setSetting(target, 'calorieGoal', 2200);
}

describe('backup, restore, reset', () => {
  it('round-trips all data through JSON', async () => {
    await populate(db);
    const json = JSON.stringify(await exportData(db));

    const other = openTestDb();
    await migrate(other);
    await addCalorieEntry(other, { calories: 999, date: D3, time: '10:00' }); // will be replaced
    await importData(other, JSON.parse(json));
    expect(await exportData(other).then((b) => b.data)).toEqual(JSON.parse(json).data);
    expect((await getTasksForDay(other, D1)).daily[0]).toMatchObject({ title: 'Workout', completed: true });
    expect((await getSettings(other)).calorieGoal).toBe(2200);
    // new rows after restore get fresh ids, no PK collisions
    await addCalorieEntry(other, { calories: 100, date: D3, time: '10:00' });
    other.close();
  });

  it('rejects invalid backups and leaves data untouched', async () => {
    await populate(db);
    const before = await exportData(db);
    expect(() => validateBackup({ app: 'something-else' })).toThrow('not a Daily Tracker backup');
    const bad = JSON.parse(JSON.stringify(before));
    bad.data.expenses[0].date = 'yesterday';
    await expect(importData(db, bad)).rejects.toThrow('Invalid date');
    expect((await exportData(db)).data).toEqual(before.data);
  });

  it('rolls back a restore that fails midway', async () => {
    await populate(db);
    const before = await exportData(db);
    const bad = JSON.parse(JSON.stringify(before));
    bad.data.expenses.push({ ...bad.data.expenses[0] }); // duplicate primary key
    await expect(importData(db, bad)).rejects.toThrow();
    expect((await exportData(db)).data).toEqual(before.data);
  });

  it('reset wipes everything and restores defaults', async () => {
    await populate(db);
    await resetAllData(db);
    const b = await exportData(db);
    expect(b.data.expenses).toHaveLength(0);
    expect(b.data.daily_tasks).toHaveLength(0);
    expect(b.data.calorie_entries).toHaveLength(0);
    expect(b.data.settings).toHaveLength(0);
    expect(await listCategories(db)).toHaveLength(8);
  });
});

describe('persistence', () => {
  it('data survives closing and reopening the database file (app restart)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-'));
    const file = path.join(dir, 'daily-tracker.db');
    const first = openTestDb(file);
    await migrate(first);
    await populate(first);
    const snapshot = (await exportData(first)).data;
    first.close();

    const second = openTestDb(file);
    await migrate(second); // runs on every launch – must not alter existing data
    expect((await exportData(second)).data).toEqual(snapshot);
    second.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
