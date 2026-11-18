import { useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { font, spacing, useTheme } from '../theme';

export interface ChartPoint {
  value: number;
  label: string;
  /** Optional second stacked value (e.g. incomplete tasks) */
  rest?: number;
}

const SECTIONS = 4;

/** Axis maximum whose 4 gridlines fall on "nice" steps (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v: number, integer = false): number {
  if (v <= 0) return SECTIONS;
  const raw = v / SECTIONS;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = integer && exp < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  for (const m of steps) {
    const step = Math.max(integer ? 1 : 0, m * exp);
    if (raw <= step) return step * SECTIONS;
  }
  return 10 * exp * SECTIONS;
}

function useLayout(n: number, width: number, yAxisWidth: number) {
  const available = Math.max(0, width - yAxisWidth - 24);
  const slot = n ? available / n : available;
  const barWidth = Math.max(10, Math.min(30, slot * 0.58));
  const gap = Math.max(8, slot - barWidth);
  return { barWidth, gap, scroll: slot < 18, available };
}

/**
 * Tappable bar chart. Tapping a bar selects it (`onSelect`) so the screen can
 * show the details of that day/week/month. Supports stacked bars and a goal line.
 */
export function TrendBars({
  data,
  color,
  restColor,
  selected,
  onSelect,
  goal,
  formatAxis = (v) => String(Math.round(v)),
  height = 180,
  integer = false,
}: {
  data: ChartPoint[];
  color: string;
  restColor?: string;
  selected: number;
  onSelect: (index: number) => void;
  goal?: number;
  formatAxis?: (v: number) => string;
  height?: number;
  integer?: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const yAxisWidth = 44;
  const { barWidth, gap } = useLayout(data.length, width, yAxisWidth);
  const top = Math.max(...data.map((d) => d.value + (d.rest ?? 0)), goal ?? 0);
  const maxValue = niceMax(top * 1.05, integer);
  const labelStyle = { color: colors.textMuted, fontSize: 10, fontWeight: '600' as const };
  const fade = (c: string, i: number) => (i === selected ? c : c + '88');

  const common = {
    height,
    width: Math.max(0, width - yAxisWidth - 16),
    maxValue,
    noOfSections: SECTIONS,
    barWidth,
    spacing: gap,
    initialSpacing: gap / 2,
    endSpacing: gap / 2,
    barBorderRadius: 6,
    yAxisThickness: 0,
    xAxisThickness: 1,
    xAxisColor: colors.border,
    rulesColor: colors.chartGrid,
    rulesType: 'solid' as const,
    yAxisLabelWidth: yAxisWidth,
    yAxisTextStyle: labelStyle,
    xAxisLabelTextStyle: { ...labelStyle, width: barWidth + gap, textAlign: 'center' as const },
    labelWidth: barWidth + gap,
    formatYLabel: (l: string) => formatAxis(Number(l)),
    isAnimated: true,
    animationDuration: 450,
    disableScroll: true,
    showReferenceLine1: goal !== undefined && goal > 0,
    referenceLine1Position: goal ?? 0,
    referenceLine1Config: { color: colors.danger, thickness: 1.5, dashWidth: 5, dashGap: 4, labelText: '' },
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ minHeight: height + 40, marginLeft: -spacing.sm, direction: 'ltr' }}>
      {width > 0 &&
        (restColor ? (
          <BarChart
            key={`stack-${data.length}-${data.map((d) => d.label).join('|')}-${maxValue}`}
            {...common}
            stackData={data.map((d, i) => ({
              label: d.label,
              onPress: () => onSelect(i),
              stacks: [
                { value: d.value, color: fade(color, i) },
                { value: d.rest ?? 0, color: fade(restColor, i), marginBottom: d.value && d.rest ? 2 : 0 },
              ],
            }))}
            stackBorderRadius={6}
          />
        ) : (
          <BarChart
            key={`bars-${data.length}-${data[0]?.label}-${maxValue}`}
            {...common}
            data={data.map((d, i) => ({ value: d.value, label: d.label, frontColor: fade(color, i) }))}
            onPress={(_: unknown, i: number) => onSelect(i)}
          />
        ))}
    </View>
  );
}

/** Smooth area line chart for percentages/trends. Tap a point to select it. */
export function TrendLine({
  data,
  color,
  selected,
  onSelect,
  maxValue = 100,
  formatAxis = (v) => `${Math.round(v)}%`,
  height = 160,
}: {
  data: ChartPoint[];
  color: string;
  selected: number;
  onSelect: (i: number) => void;
  maxValue?: number;
  formatAxis?: (v: number) => string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const yAxisWidth = 40;
  const chartWidth = Math.max(0, width - yAxisWidth - 24);
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const labelStyle = { color: colors.textMuted, fontSize: 10, fontWeight: '600' as const };
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ minHeight: height + 40, marginLeft: -spacing.sm, direction: 'ltr' }}>
      {width > 0 && (
        <LineChart
          data={data.map((d, i) => ({
            value: d.value,
            label: d.label,
            dataPointRadius: i === selected ? 6 : 3.5,
            dataPointColor: color,
            onPress: () => onSelect(i),
          }))}
          height={height}
          width={chartWidth + 12}
          maxValue={maxValue}
          noOfSections={SECTIONS}
          spacing={step}
          initialSpacing={6}
          endSpacing={6}
          curved
          curvature={0.15}
          areaChart
          color={color}
          thickness={2.5}
          startFillColor={color}
          endFillColor={color}
          startOpacity={0.25}
          endOpacity={0.02}
          dataPointsColor={color}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.border}
          rulesColor={colors.chartGrid}
          rulesType="solid"
          yAxisLabelWidth={yAxisWidth}
          yAxisTextStyle={labelStyle}
          xAxisLabelTextStyle={{ ...labelStyle, width: Math.max(28, step), textAlign: 'center', marginLeft: -Math.max(28, step) / 2 + 6 }}
          formatYLabel={(l: string) => formatAxis(Number(l))}
          disableScroll
          isAnimated
          animationDuration={500}
        />
      )}
    </View>
  );
}

export interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

/** Donut chart with legend. Tapping a slice or legend row highlights it. */
export function Donut({
  data,
  centerTitle,
  centerValue,
  format,
}: {
  data: DonutSlice[];
  centerTitle: string;
  centerValue: string;
  format: (v: number) => string;
}) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const f = focus !== null && focus < data.length ? data[focus] : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
      <PieChart
        data={data.map((d, i) => ({ value: d.value, color: d.color, focused: i === focus, onPress: () => setFocus(i === focus ? null : i) }))}
        donut
        radius={74}
        innerRadius={50}
        innerCircleColor={colors.card}
        focusOnPress
        sectionAutoFocus
        extraRadius={6}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center', maxWidth: 92 }}>
            <Text style={[font.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {f ? f.label : centerTitle}
            </Text>
            <Text style={[font.heading, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {f ? format(f.value) : centerValue}
            </Text>
            {f ? (
              <Text style={[font.caption, { color: colors.textFaint }]}>{Math.round((f.value / total) * 100)}%</Text>
            ) : null}
          </View>
        )}
      />
      <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
        {data.map((d, i) => (
          <Text
            key={d.label + i}
            onPress={() => setFocus(i === focus ? null : i)}
            style={[font.label, { color: focus === null || focus === i ? colors.text : colors.textFaint }]}
            numberOfLines={1}
          >
            <Text style={{ color: d.color }}>● </Text>
            {d.label} · {format(d.value)} ({Math.round((d.value / total) * 100)}%)
          </Text>
        ))}
      </View>
    </View>
  );
}
