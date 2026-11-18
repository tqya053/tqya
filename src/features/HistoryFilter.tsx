import { useState } from 'react';
import { View } from 'react-native';
import { pickDate } from '../components/pickers';
import { Chip } from '../components/ui';
import { formatShortDate, startOfMonth, startOfWeek, type DateKey } from '../lib/dates';
import { t } from '../i18n/translate';
import { spacing } from '../theme';

export type HistoryRange = { kind: 'all' | 'today' | 'week' | 'month' | 'day'; day?: DateKey };

export function rangeBounds(r: HistoryRange, today: DateKey): { start?: DateKey; end?: DateKey } {
  switch (r.kind) {
    case 'today':
      return { start: today, end: today };
    case 'week':
      return { start: startOfWeek(today), end: today };
    case 'month':
      return { start: startOfMonth(today), end: today };
    case 'day':
      return { start: r.day, end: r.day };
    default:
      return {};
  }
}

export function useHistoryRange() {
  return useState<HistoryRange>({ kind: 'all' });
}

export function HistoryFilter({
  value,
  onChange,
  color,
  today,
}: {
  value: HistoryRange;
  onChange: (r: HistoryRange) => void;
  color: string;
  today: DateKey;
}) {
  const opts: { kind: HistoryRange['kind']; label: string }[] = [
    { kind: 'all', label: t('All') },
    { kind: 'today', label: t('Today') },
    { kind: 'week', label: t('This week') },
    { kind: 'month', label: t('This month') },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {opts.map((o) => (
        <Chip key={o.kind} label={o.label} color={color} selected={value.kind === o.kind} onPress={() => onChange({ kind: o.kind })} />
      ))}
      <Chip
        label={value.kind === 'day' && value.day ? formatShortDate(value.day) : t('Pick day')}
        icon="calendar-outline"
        color={color}
        selected={value.kind === 'day'}
        onPress={async () => {
          const d = await pickDate(value.day ?? today, { maxDate: today });
          if (d) onChange({ kind: 'day', day: d });
        }}
      />
    </View>
  );
}
