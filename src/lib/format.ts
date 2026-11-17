/** Parses user-typed money ("12", "12.5", "12,50") to integer cents, or null. */
export function parseAmountToCents(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Sanitises an amount being typed: digits plus at most one separator and two decimals. */
export function sanitizeAmountInput(input: string): string {
  let s = input.replace(',', '.').replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  }
  return s.replace(/^0+(?=\d)/, '').slice(0, 12);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export function formatMoney(cents: number, symbol: string, compact = false): string {
  const value = cents / 100;
  if (compact && Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `${symbol}${k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  const fixed = value.toFixed(Number.isInteger(value) && compact ? 0 : 2);
  const [w, f] = fixed.split('.');
  const withSep = w.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${f ? `${withSep}.${f}` : withSep}`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

export function parseCalories(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,5}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}
