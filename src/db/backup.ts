import { isValidDateKey, isValidTimeKey } from '../lib/dates';
import { SCHEMA_VERSION, seedDefaults } from './schema';
import type { DB, SQLParam } from './types';

export const BACKUP_APP_ID = 'daily-tracker';

type ColType = 'int' | 'text' | 'text?' | 'date' | 'date?' | 'time';

/** Column definitions per table, in parent → child insertion order. */
const TABLE_COLUMNS: Record<string, Record<string, ColType>> = {
  settings: { key: 'text', value: 'text' },
  daily_tasks: { id: 'int', name: 'text', created_date: 'date', archived_date: 'date?', sort_order: 'int', created_at: 'text' },
  daily_task_logs: { task_id: 'int', date: 'date', completed_at: 'text' },
  one_time_tasks: { id: 'int', title: 'text', date: 'date', completed: 'int', completed_at: 'text?', created_at: 'text' },
  expense_categories: { id: 'int', name: 'text', icon: 'text', color: 'text', is_other: 'int', sort_order: 'int', archived: 'int' },
  expenses: { id: 'int', amount_cents: 'int', category_id: 'int', description: 'text?', date: 'date', time: 'time', created_at: 'text' },
  calorie_entries: { id: 'int', calories: 'int', date: 'date', time: 'time', created_at: 'text' },
};

const INSERT_ORDER = Object.keys(TABLE_COLUMNS);
const DELETE_ORDER = ['daily_task_logs', 'expenses', 'calorie_entries', 'one_time_tasks', 'daily_tasks', 'expense_categories', 'settings'];

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, Record<string, SQLParam>[]>;
}

export async function exportData(db: DB): Promise<BackupFile> {
  const data: BackupFile['data'] = {};
  for (const table of INSERT_ORDER) {
    const cols = Object.keys(TABLE_COLUMNS[table]).join(', ');
    data[table] = await db.getAllAsync<Record<string, SQLParam>>(`SELECT ${cols} FROM ${table}`, []);
  }
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

function checkValue(table: string, col: string, type: ColType, v: unknown, row: number): SQLParam {
  const where = `${table}[${row}].${col}`;
  const optional = type.endsWith('?');
  if (v === null || v === undefined) {
    if (optional) return null;
    throw new Error(`Missing value at ${where}`);
  }
  switch (type) {
    case 'int':
      if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error(`Expected integer at ${where}`);
      return v;
    case 'date':
    case 'date?':
      if (!isValidDateKey(v)) throw new Error(`Invalid date at ${where}`);
      return v;
    case 'time':
      if (!isValidTimeKey(v)) throw new Error(`Invalid time at ${where}`);
      return v;
    default:
      if (typeof v !== 'string') throw new Error(`Expected text at ${where}`);
      return v;
  }
}

/** Validates a parsed backup and returns rows ready to insert. Throws on any problem. */
export function validateBackup(input: unknown): BackupFile {
  if (!input || typeof input !== 'object') throw new Error('Not a valid backup file');
  const b = input as Partial<BackupFile>;
  if (b.app !== BACKUP_APP_ID) throw new Error('This file is not a Daily Tracker backup');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of the app');
  }
  if (!b.data || typeof b.data !== 'object') throw new Error('Backup has no data');
  const data: BackupFile['data'] = {};
  for (const table of INSERT_ORDER) {
    const rows = (b.data as Record<string, unknown>)[table] ?? [];
    if (!Array.isArray(rows)) throw new Error(`Backup table "${table}" is malformed`);
    const cols = TABLE_COLUMNS[table];
    data[table] = rows.map((r, i) => {
      if (!r || typeof r !== 'object') throw new Error(`Row ${i} of "${table}" is malformed`);
      const out: Record<string, SQLParam> = {};
      for (const [col, type] of Object.entries(cols)) {
        out[col] = checkValue(table, col, type, (r as Record<string, unknown>)[col], i);
      }
      return out;
    });
  }
  if (!data.expense_categories.some((c) => c.is_other === 1)) {
    throw new Error('Backup is missing the "Other" category');
  }
  return { app: BACKUP_APP_ID, schemaVersion: b.schemaVersion, exportedAt: String(b.exportedAt ?? ''), data };
}

/** Replaces ALL current data with the backup, atomically (all or nothing). */
export async function importData(db: DB, input: unknown): Promise<{ counts: Record<string, number> }> {
  const backup = validateBackup(input);
  const counts: Record<string, number> = {};
  await db.withTransactionAsync(async () => {
    for (const t of DELETE_ORDER) await db.runAsync(`DELETE FROM ${t}`, []);
    for (const table of INSERT_ORDER) {
      const cols = Object.keys(TABLE_COLUMNS[table]);
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      for (const row of backup.data[table]) {
        await db.runAsync(sql, cols.map((c) => row[c]));
      }
      counts[table] = backup.data[table].length;
    }
  });
  return { counts };
}

/** Deletes every record and restores the default categories and settings. */
export async function resetAllData(db: DB): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of DELETE_ORDER) await db.runAsync(`DELETE FROM ${t}`, []);
    await db.runAsync(`DELETE FROM sqlite_sequence`, []).catch(() => undefined);
    await seedDefaults(db);
  });
}
