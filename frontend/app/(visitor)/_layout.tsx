import { Tabs } from 'expo-router';
import { Home, Ticket, User } from 'lucide-react-native';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { LanguageSelector } from '../../src/components/LanguageSelector';

// Home is public (like the website landing page); bookings, profile, book,
// group and booking detail require sign-in via useRequireAuth in each screen.
export default function VisitorLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{
      headerShown: true, tabBarActiveTintColor: '#2E7D32',
      headerStyle: { backgroundColor: '#2E7D32' }, headerTintColor: '#fff',
      headerRight: () => <LanguageSelector />,
    }}>
      <Tabs.Screen name="home" options={{ title: 'ZNHM-AAU', tabBarLabel: t('home'), tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="bookings" options={{ title: t('my_bookings'), tabBarLabel: t('my_bookings'), tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarLabel: t('profile'), tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
      <Tabs.Screen name="book" options={{ title: t('book_a_visit'), href: null }} />
      <Tabs.Screen name="group" options={{ title: t('group_visit_request'), href: null }} />
      <Tabs.Screen name="booking/[id]" options={{ title: t('booking_details'), href: null }} />
    </Tabs>
  );
}
