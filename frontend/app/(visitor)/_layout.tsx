import { Tabs } from 'expo-router';
import { Home, Ticket, User } from 'lucide-react-native';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { useTheme } from '../../src/lib/theme/useTheme';

export default function VisitorLayout() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: isDark ? colors.bg : colors.card,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 4} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('my_bookings'),
          tabBarIcon: ({ color, size }) => <Ticket color={color} size={size - 4} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size - 4} />,
        }}
      />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="group" options={{ href: null }} />
      <Tabs.Screen name="booking/[id]" options={{ href: null }} />
    </Tabs>
  );
}
