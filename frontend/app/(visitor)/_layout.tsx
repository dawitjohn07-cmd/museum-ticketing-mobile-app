import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Home, Ticket, User } from 'lucide-react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { useTranslation } from '../../src/lib/i18n/useTranslation';
import { LanguageSelector } from '../../src/components/LanguageSelector';

export default function VisitorLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ 
      headerShown: true, 
      tabBarActiveTintColor: '#2E7D32', // Natural history green
      headerStyle: {
        backgroundColor: '#2E7D32',
      },
      headerTintColor: '#fff',
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'ZNHM-AAU',
          tabBarLabel: t('home'),
          headerRight: () => <LanguageSelector />,
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('my_bookings'),
          tabBarLabel: t('my_bookings'),
          tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarLabel: t('profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: t('book_a_visit'),
          href: null, // Don't show in tab bar directly, accessed from Home
        }}
      />
      <Tabs.Screen
        name="booking/[id]"
        options={{
          title: t('booking_details'),
          href: null, 
        }}
      />
    </Tabs>
  );
}
