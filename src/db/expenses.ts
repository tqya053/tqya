import type { DateKey } from '../lib/dates';
import { isValidDateKey, isValidTimeKey } from '../lib/dates';
import { CATEGORY_COLORS } from './schema';
import type { Category, DB, ExpenseWithCategory } from './types';

// ───────────────────────── Categories ─────────────────────────

function cleanCategoryName(name: string): string {
  const v = name.trim().replace(/\s+/g, ' ');
  if (!v) throw new Error('Category name cannot be empty');
  if (v.length > 40) throw new Error('Category name is too long');
  return v;
}

export async function listCategories(db: DB, includeArchived = false): Promise<Category[]> {
  return db.getAllAsync<Category>(
    `SELECT * FROM expense_categories ${includeArchived ? '' : 'WHERE archived = 0'}
     ORDER BY is_other, sort_order, id`,
    [],
  );
}

async function findActiveByName(db: DB, name: string, exceptId?: number) {
  return db.getFirstAsync<Category>(
    'SELECT * FROM expense_categories WHERE name = ? COLLATE NOCASE AND archived = 0 AND id != ?',
    [name, exceptId ?? -1],
  );
}

export async function addCategory(db: DB, rawName: string): Promise<number> {
  const name = cleanCategoryName(rawName);
  if (await findActiveByName(db, name)) throw new Error(`"${name}" already exists`);
  // Re-adding a previously deleted category restores it (and its history).
  const archived = await db.getFirstAsync<Category>(
    'SELECT * FROM expense_categories WHERE name = ? COLLATE NOCASE AND archived = 1',
    [name],
  );
  if (archived) {
    await db.runAsync('UPDATE expense_categories SET archived = 0, name = ? WHERE id = ?', [name, archived.id]);
    return archived.id;
  }
  const stats = await db.getFirstAsync<{ n: number; m: number | null }>(
    'SELECT COUNT(*) AS n, MAX(sort_order) AS m FROM expense_categories',
    [],
  );
  const color = CATEGORY_COLORS[(stats?.n ?? 0) % CATEGORY_COLORS.length];
  const res = await db.runAsync(
    'INSERT INTO expense_categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
    [name, 'pricetag-outline', color, (stats?.m ?? 0) + 1],
  );
  return res.lastInsertRowId;
}

export async function renameCategory(db: DB, id: number, rawName: string): Promise<void> {
  const name = cleanCategoryName(rawName);
  if (await findActiveByName(db, name, id)) throw new Error(`"${name}" already exists`);
  await db.runAsync('UPDATE expense_categories SET name = ? WHERE id = ?', [name, id]);
}

/**
 * Deletes a category. If expenses reference it, it is archived instead so the
 * history keeps its name and color. The built-in "Other" category is required.
 */
export async function deleteCategory(db: DB, id: number): Promise<'deleted' | 'archived'> {
  const cat = await db.getFirstAsync<Category>('SELECT * FROM expense_categories WHERE id = ?', [id]);
  if (!cat) return 'deleted';
  if (cat.is_other) throw new Error('The "Other" category cannot be deleted');
  const used = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?', [id]);
  if (used && used.n > 0) {
    await db.runAsync('UPDATE expense_categories SET archived = 1 WHERE id = ?', [id]);
    return 'archived';
  }
  await db.runAsync('DELETE FROM expense_categories WHERE id = ?', [id]);
  return 'deleted';
}

// ───────────────────────── Expenses ─────────────────────────

export interface ExpenseInput {
  amountCents: number;
  categoryId: number;
  description?: string | null;
  date: DateKey;
  time: string;
}

async function validateExpense(db: DB, e: ExpenseInput) {
  if (!Number.isInteger(e.amountCents) || e.amountCents <= 0) throw new Error('Enter an amount greater than 0');
  if (e.amountCents > 100_000_000_00) throw new Error('Amount is too large');
  if (!isValidDateKey(e.date)) throw new Error('Invalid date');
  if (!isValidTimeKey(e.time)) throw new Error('Invalid time');
  const cat = await db.getFirstAsync<Category>('SELECT * FROM expense_categories WHERE id = ?', [e.categoryId]);
  if (!cat) throw new Error('Choose a category');
  const description = e.description?.trim() || null;
  if (cat.is_other && !description) throw new Error('Describe what this "Other" expense was');
  return description;
}

export async function addExpense(db: DB, e: ExpenseInput): Promise<number> {
  const description = await validateExpense(db, e);
  const res = await db.runAsync(
    'INSERT INTO expenses (amount_cents, category_id, description, date, time) VALUES (?, ?, ?, ?, ?)',
    [e.amountCents, e.categoryId, description, e.date, e.time],
  );
  return res.lastInsertRowId;
}

export async function updateExpense(db: DB, id: number, e: ExpenseInput): Promise<void> {
  const description = await validateExpense(db, e);
  await db.runAsync(
    'UPDATE expenses SET amount_cents = ?, category_id = ?, description = ?, date = ?, time = ? WHERE id = ?',
    [e.amountCents, e.categoryId, description, e.date, e.time, id],
  );
}

export async function deleteExpense(db: DB, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

const EXPENSE_SELECT = `
  SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
  FROM expenses e JOIN expense_categories c ON c.id = e.category_id`;

/** Expenses between two dates (inclusive), newest first. Omit bounds for all. */
export async function listExpenses(db: DB, start?: DateKey, end?: DateKey): Promise<ExpenseWithCategory[]> {
  return db.getAllAsync<ExpenseWithCategory>(
    `${EXPENSE_SELECT} WHERE e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.time DESC, e.id DESC`,
    [start ?? '0000-00-00', end ?? '9999-12-31'],
  );
}

export async function getExpense(db: DB, id: number): Promise<ExpenseWithCategory | null> {
  return db.getFirstAsync<ExpenseWithCategory>(`${EXPENSE_SELECT} WHERE e.id = ?`, [id]);
}

export async function getExpenseTotalsByDay(
  db: DB,
  start: DateKey,
  end: DateKey,
): Promise<{ date: DateKey; total_cents: number }[]> {
  return db.getAllAsync(
    'SELECT date, SUM(amount_cents) AS total_cents FROM expenses WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
    [start, end],
  );
}

export async function getFirstExpenseDate(db: DB): Promise<DateKey | null> {
  const row = await db.getFirstAsync<{ d: string | null }>('SELECT MIN(date) AS d FROM expenses', []);
  return row?.d ?? null;
}
