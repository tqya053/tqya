import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatTime12,
  isValidDateKey,
  isValidTimeKey,
  parseDateKey,
  relativeDayLabel,
  toDateKey,
  toTimeKey,
  type DateKey,
} from '../lib/dates';
import { t } from '../i18n/translate';
import { font, radius, spacing, useTheme } from '../theme';

/** Opens the native date picker. Resolves with the chosen date key or null if dismissed. */
export function pickDate(current: DateKey, opts: { maxDate?: DateKey } = {}): Promise<DateKey | null> {
  if (Platform.OS === 'web') {
    const v = globalThis.prompt?.(t('Date (YYYY-MM-DD)'), current) ?? null;
    return Promise.resolve(v && isValidDateKey(v) && (!opts.maxDate || v <= opts.maxDate) ? v : null);
  }
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: parseDateKey(current),
      mode: 'date',
      maximumDate: opts.maxDate ? parseDateKey(opts.maxDate) : undefined,
      onChange: (event, date) => resolve(event.type === 'set' && date ? toDateKey(date) : null),
    });
  });
}

export function pickTime(current: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const v = globalThis.prompt?.(t('Time (HH:MM, 24h)'), current) ?? null;
    return Promise.resolve(v && isValidTimeKey(v) ? v : null);
  }
  const [h, m] = current.split(':').map(Number);
  const base = new Date();
  base.setHours(h, m, 0, 0);
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      onChange: (event, date) => resolve(event.type === 'set' && date ? toTimeKey(date) : null),
    });
  });
}

function PickerButton({ icon, label, value, onPress }: { icon: 'calendar-outline' | 'time-outline'; label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.btn, { backgroundColor: colors.cardAlt, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[font.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[font.body, { color: colors.text }]}>{value}</Text>
      </View>
    </Pressable>
  );
}

export function DateTimeFields({
  date,
  time,
  today,
  onChange,
}: {
  date: DateKey;
  time?: string;
  today: DateKey;
  onChange: (v: { date: DateKey; time?: string }) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <PickerButton
          icon="calendar-outline"
          label={t('Date')}
          value={relativeDayLabel(date, today)}
          onPress={async () => {
            const d = await pickDate(date, { maxDate: time !== undefined ? today : undefined });
            if (d) onChange({ date: d, time });
          }}
        />
      </View>
      {time !== undefined && (
        <View style={{ flex: 1 }}>
          <PickerButton
            icon="time-outline"
            label={t('Time')}
            value={formatTime12(time)}
            onPress={async () => {
              const picked = await pickTime(time);
              if (picked) onChange({ date, time: picked });
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
});
