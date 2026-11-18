/**
 * Date helpers. All persisted dates are LOCAL calendar days formatted as
 * `YYYY-MM-DD` ("date keys") and local times as `HH:MM`. We never use
 * `toISOString()` for day keys because it converts to UTC and would shift
 * late-evening entries into the next/previous day.
 */

import { getLang } from '../i18n/translate';

export type DateKey = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeKey(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a date key as local midnight (DST safe). */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(parseDateKey(key)) === key;
}

export function isValidTimeKey(key: unknown): key is string {
  if (typeof key !== 'string' || !/^\d{2}:\d{2}$/.test(key)) return false;
  const [h, m] = key.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function addMonths(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Inclusive number of days between two keys (a <= b). */
export function daysBetween(a: DateKey, b: DateKey): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Week starts on Monday. */
export function startOfWeek(key: DateKey): DateKey {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -dow);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  return addDays(addMonths(key, 1), -1);
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b;
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b;
}

/** Inclusive list of date keys from start to end. */
export function rangeKeys(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

const NAMES = {
  en: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    am: 'AM',
    pm: 'PM',
  },
  ar: {
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    monthsLong: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    weekdaysLong: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    today: 'اليوم',
    yesterday: 'أمس',
    tomorrow: 'غداً',
    am: 'ص',
    pm: 'م',
  },
};

const names = () => NAMES[getLang()];

export function formatLongDate(key: DateKey): string {
  const d = parseDateKey(key);
  const n = names();
  if (getLang() === 'ar') return `${n.weekdaysLong[d.getDay()]}، ${d.getDate()} ${n.monthsLong[d.getMonth()]} ${d.getFullYear()}`;
  return `${n.weekdaysLong[d.getDay()]}, ${n.monthsLong[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShortDate(key: DateKey): string {
  const d = parseDateKey(key);
  const n = names();
  return getLang() === 'ar' ? `${d.getDate()} ${n.months[d.getMonth()]}` : `${n.months[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonth(key: DateKey, withYear = false): string {
  const d = parseDateKey(key);
  const m = names().months[d.getMonth()];
  return withYear ? `${m} ${d.getFullYear()}` : m;
}

export function weekdayShort(key: DateKey): string {
  return names().weekdays[parseDateKey(key).getDay()];
}

/** "Today", "Yesterday", "Tomorrow" or "Mon, Mar 4". */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const n = names();
  if (key === today) return n.today;
  if (key === addDays(today, -1)) return n.yesterday;
  if (key === addDays(today, 1)) return n.tomorrow;
  const d = parseDateKey(key);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  const year = sameYear ? '' : getLang() === 'ar' ? ` ${d.getFullYear()}` : `, ${d.getFullYear()}`;
  return getLang() === 'ar'
    ? `${n.weekdays[d.getDay()]}، ${d.getDate()} ${n.months[d.getMonth()]}${year}`
    : `${n.weekdays[d.getDay()]}, ${n.months[d.getMonth()]} ${d.getDate()}${year}`;
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? names().pm : names().am;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}
