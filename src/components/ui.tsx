import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { font, radius, spacing, useTheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else
    Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
}

/** Fades + slides content in on mount for smooth screen transitions. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={[font.label, { color: colors.textMuted, marginBottom: 2 }]}>{subtitle}</Text> : null}
        <Text style={[font.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowOpacity: dark ? 0 : 0.05,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[font.heading, { color: colors.text, flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  color,
  disabled,
  loading,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  const bg =
    variant === 'primary' ? accent : variant === 'danger' ? colors.dangerSoft : variant === 'secondary' ? colors.cardAlt : 'transparent';
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : variant === 'ghost' ? accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={fg} /> : null}
          <Text style={[compact ? font.label : font.heading, { color: fg, fontSize: compact ? 13 : 16 }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 20,
  filled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: filled ? colors.cardAlt : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.textMuted} />
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accent,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  // Items are laid out right-to-left in Arabic; the thumb is positioned physically from the left.
  const index = rtl ? options.length - 1 - selectedIndex : selectedIndex;
  const pos = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(pos, { toValue: index, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }, [index, pos]);
  const segW = width ? (width - 8) / options.length : 0;
  return (
    <View
      style={[styles.segmented, { backgroundColor: colors.cardAlt }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segW > 0 && (
        <Animated.View
          style={[
            styles.segThumb,
            {
              width: segW,
              backgroundColor: colors.card,
              transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }],
            },
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.segItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic();
              onChange(o.value);
            }}
          >
            <Text style={[font.label, { color: active ? accent ?? colors.text : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressRing({
  progress,
  size = 120,
  stroke = 12,
  color,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ progress, color, height = 8 }: { progress: number; color: string; height?: number }) {
  const { colors } = useTheme();
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const { rtl } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[font.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[
          styles.field,
          { backgroundColor: colors.cardAlt, color: colors.text, borderColor: colors.border, textAlign: rtl ? 'right' : 'left' },
          style,
        ]}
      />
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel={t('Close')} />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[font.heading, { color: colors.text, flex: 1 }]}>{title}</Text>
            <IconButton icon="close" label={t('Close')} onPress={onClose} filled />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg }} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.cardAlt }]}>
        <Ionicons name={icon} size={26} color={colors.textFaint} />
      </View>
      <Text style={[font.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text> : null}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  color,
  icon,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, gap: 4 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={14} color={color ?? colors.textMuted} /> : null}
        <Text style={[font.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[font.heading, { color: color ?? colors.text, fontSize: 19 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={[font.caption, { color: colors.textFaint }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  color,
  onPress,
  onLongPress,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? color : colors.cardAlt,
          borderColor: selected ? color : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : color} /> : null}
      <Text style={[font.label, { color: selected ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({
  children,
  style,
  gap = spacing.md,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4, position: 'relative' },
  segThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  field: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
