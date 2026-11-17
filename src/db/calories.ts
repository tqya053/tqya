import type { DateKey } from '../lib/dates';
import { isValidDateKey, isValidTimeKey } from '../lib/dates';
import type { CalorieEntry, DB } from './types';

export interface CalorieInput {
  calories: number;
  date: DateKey;
  time: string;
}

function validate(e: CalorieInput) {
  if (!Number.isInteger(e.calories) || e.calories <= 0) throw new Error('Enter calories greater than 0');
  if (e.calories > 50_000) throw new Error('That is a lot of calories — please check the number');
  if (!isValidDateKey(e.date)) throw new Error('Invalid date');
  if (!isValidTimeKey(e.time)) throw new Error('Invalid time');
}

export async function addCalorieEntry(db: DB, e: CalorieInput): Promise<number> {
  validate(e);
  const res = await db.runAsync('INSERT INTO calorie_entries (calories, date, time) VALUES (?, ?, ?)', [
    e.calories,
    e.date,
    e.time,
  ]);
  return res.lastInsertRowId;
}

export async function updateCalorieEntry(db: DB, id: number, e: CalorieInput): Promise<void> {
  validate(e);
  await db.runAsync('UPDATE calorie_entries SET calories = ?, date = ?, time = ? WHERE id = ?', [
    e.calories,
    e.date,
    e.time,
    id,
  ]);
}

export async function deleteCalorieEntry(db: DB, id: number): Promise<void> {
  await db.runAsync('DELETE FROM calorie_entries WHERE id = ?', [id]);
}

export async function listCalorieEntries(db: DB, start?: DateKey, end?: DateKey): Promise<CalorieEntry[]> {
  return db.getAllAsync<CalorieEntry>(
    'SELECT * FROM calorie_entries WHERE date BETWEEN ? AND ? ORDER BY date DESC, time DESC, id DESC',
    [start ?? '0000-00-00', end ?? '9999-12-31'],
  );
}

export async function getCalorieTotalsByDay(
  db: DB,
  start: DateKey,
  end: DateKey,
): Promise<{ date: DateKey; total: number }[]> {
  return db.getAllAsync(
    'SELECT date, SUM(calories) AS total FROM calorie_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
    [start, end],
  );
}
