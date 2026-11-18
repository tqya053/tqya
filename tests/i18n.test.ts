import fs from 'fs';
import path from 'path';
import { AR } from '../src/i18n/ar';
import { categoryLabel, setLang, t, translateError } from '../src/i18n/translate';
import { DEFAULT_CATEGORIES } from '../src/db/schema';
import { formatLongDate, formatTime12, relativeDayLabel } from '../src/lib/dates';
import { getBuckets } from '../src/lib/stats';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

afterEach(() => setLang('en'));

describe('Arabic translations', () => {
  const src = sourceFiles(path.join(__dirname, '..', 'src')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

  it('every literal t() string has an Arabic translation', () => {
    const keys = [...src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    expect(keys.length).toBeGreaterThan(150);
    expect([...new Set(keys)].filter((k) => !(k in AR))).toEqual([]);
  });

  it('dynamic keys (periods, tabs, greetings, categories, errors) are translated', () => {
    const dynamic = [
      'Home', 'Tasks', 'Expenses', 'Calories', 'Statistics', 'Daily', 'Weekly', 'Monthly',
      'Good night', 'Good morning', 'Good afternoon', 'Good evening',
      ...['day', 'week', 'month'].flatMap((u) => [
        `This ${u}`, `Last ${u}`, `Total (last {n} ${u}s)`, `Completion rate per ${u}`,
        `Compares the same number of elapsed days in each ${u}.`,
      ]),
      ...DEFAULT_CATEGORIES.map((c) => `cat:${c.name}`),
    ];
    expect(dynamic.filter((k) => !(k in AR))).toEqual([]);
    const dbSrc = sourceFiles(path.join(__dirname, '..', 'src', 'db')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const errors = [...dbSrc.matchAll(/throw new Error\('([^']*)'\)/g)].map((m) => m[1]);
    expect(errors.filter((k) => !(k in AR))).toEqual([]);
  });

  it('interpolates, translates categories and errors, and formats dates in Arabic', () => {
    setLang('ar');
    expect(t('{a} of {b} days', { a: 3, b: 7 })).toBe('3 من 7 يوماً');
    expect(categoryLabel('Coffee')).toBe('القهوة');
    expect(categoryLabel('My custom')).toBe('My custom');
    expect(translateError('"Books" already exists')).toBe('"Books" موجودة مسبقاً');
    expect(formatLongDate('2026-11-17')).toBe('الثلاثاء، 17 نوفمبر 2026');
    expect(relativeDayLabel('2026-11-16', '2026-11-17')).toBe('أمس');
    expect(formatTime12('21:05')).toBe('9:05 م');
    expect(getBuckets('weekly', '2026-11-17').at(-1)?.title).toBe('أسبوع 16 نوفمبر');
  });

  it('English stays the default', () => {
    expect(t('Add task')).toBe('Add task');
    expect(formatLongDate('2026-11-17')).toBe('Tuesday, November 17, 2026');
  });
});
