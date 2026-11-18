import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../../components/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useTheme } from '../../theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'tasks', title: 'Tasks', icon: 'checkbox-outline', iconActive: 'checkbox' },
  { name: 'expenses', title: 'Expenses', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'calories', title: 'Calories', icon: 'flame-outline', iconActive: 'flame' },
  { name: 'stats', title: 'Statistics', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
];

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? tab.iconActive : tab.icon} size={size - 2} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
