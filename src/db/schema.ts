import type { DB } from './types';

export const DATABASE_NAME = 'daily-tracker.db';

/**
 * Ordered migrations. Each entry upgrades the schema from version `index` to
 * `index + 1` (tracked with `PRAGMA user_version`). Never edit a shipped
 * migration — append a new one so existing installs upgrade in place.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  -- Permanent (recurring) tasks. A task is active on day D when
  -- created_date <= D AND (archived_date IS NULL OR archived_date > D).
  -- Deleting only sets archived_date, so past days keep their history.
  CREATE TABLE IF NOT EXISTS daily_tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    created_date  TEXT NOT NULL,
    archived_date TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One row per (task, day) completion. Completion "resets" every day
  -- naturally because a new day has no rows yet.
  CREATE TABLE IF NOT EXISTS daily_task_logs (
    task_id      INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
    date         TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (task_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_task_logs_date ON daily_task_logs(date);

  CREATE TABLE IF NOT EXISTS one_time_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    date         TEXT NOT NULL,
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_one_time_tasks_date ON one_time_tasks(date);

  CREATE TABLE IF NOT EXISTS expense_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL COLLATE NOCASE,
    icon       TEXT NOT NULL,
    color      TEXT NOT NULL,
    is_other   INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category_id  INTEGER NOT NULL REFERENCES expense_categories(id),
    description  TEXT,
    date         TEXT NOT NULL,
    time         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

  CREATE TABLE IF NOT EXISTS calorie_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    calories   INTEGER NOT NULL CHECK (calories > 0),
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_calorie_entries_date ON calorie_entries(date);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export const DEFAULT_CATEGORIES: { name: string; icon: string; color: string; is_other?: number }[] = [
  { name: 'Transportation', icon: 'car-outline', color: '#3B82F6' },
  { name: 'Gym', icon: 'barbell-outline', color: '#8B5CF6' },
  { name: 'Coffee', icon: 'cafe-outline', color: '#A16207' },
  { name: 'Food', icon: 'restaurant-outline', color: '#F97316' },
  { name: 'Dental', icon: 'medkit-outline', color: '#06B6D4' },
  { name: 'Shopping', icon: 'bag-handle-outline', color: '#EC4899' },
  { name: 'Entertainment', icon: 'film-outline', color: '#EAB308' },
  { name: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', is_other: 1 },
];

/** Colors assigned to user-created categories, in rotation. */
export const CATEGORY_COLORS = [
  '#10B981', '#EF4444', '#6366F1', '#14B8A6', '#F59E0B', '#D946EF', '#0EA5E9', '#84CC16', '#F43F5E', '#22C55E',
];

export const TABLES = [
  'settings',
  'daily_tasks',
  'daily_task_logs',
  'one_time_tasks',
  'expense_categories',
  'expenses',
  'calorie_entries',
] as const;

export async function seedDefaults(db: DB): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expense_categories', []);
  if (row && row.n > 0) return;
  let order = 0;
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO expense_categories (name, icon, color, is_other, sort_order) VALUES (?, ?, ?, ?, ?)',
      [c.name, c.icon, c.color, c.is_other ?? 0, order++],
    );
  }
}

/** Bring the database to the latest schema and make sure defaults exist. */
export async function migrate(db: DB): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  await seedDefaults(db);
}
