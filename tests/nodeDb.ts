/* Test adapter: implements the app's `DB` contract on Node's built-in SQLite,
 * so repository code runs against a real SQLite engine (same SQL dialect as
 * expo-sqlite on Android). */
import type { DB, SQLParam } from '../src/db/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require(['node', 'sqlite'].join(':')) as typeof import('node:sqlite');

export interface TestDB extends DB {
  close(): void;
}

export function openTestDb(path = ':memory:'): TestDB {
  const raw = new DatabaseSync(path);
  let depth = 0;
  return {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params: SQLParam[]) {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: SQLParam[]) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SQLParam[]) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      if (depth > 0) return task();
      depth++;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      raw.close();
    },
  };
}
