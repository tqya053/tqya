import type { DateKey } from '../lib/dates';

/**
 * Minimal async database contract. `expo-sqlite`'s `SQLiteDatabase` satisfies it
 * structurally, and tests provide a Node (`node:sqlite`) implementation, so all
 * repository logic is exercised against a real SQLite engine.
 */
export interface DB {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params: SQLParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SQLParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type SQLParam = string | number | null;

export interface DailyTask {
  id: number;
  name: string;
  created_date: DateKey;
  archived_date: DateKey | null;
  sort_order: number;
}

export interface DailyTaskLog {
  task_id: number;
  date: DateKey;
  completed_at: string;
}

export interface OneTimeTask {
  id: number;
  title: string;
  date: DateKey;
  completed: number; // 0 | 1
  completed_at: string | null;
  created_at: string;
}

/** A task as shown on a given day, unifying both kinds. */
export interface DayTask {
  kind: 'daily' | 'once';
  id: number;
  title: string;
  completed: boolean;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_other: number; // 0 | 1 – the built-in "Other" category (asks for a description)
  sort_order: number;
  archived: number; // 0 | 1 – deleted but kept for history
}

export interface Expense {
  id: number;
  amount_cents: number;
  category_id: number;
  description: string | null;
  date: DateKey;
  time: string; // HH:MM
  created_at: string;
}

export interface ExpenseWithCategory extends Expense {
  category_name: string;
  category_icon: string;
  category_color: string;
}

export interface CalorieEntry {
  id: number;
  calories: number;
  date: DateKey;
  time: string;
  created_at: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  calorieGoal: number;
  currency: string;
  theme: ThemePreference;
}
