import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from '../src/lib/i18n/useTranslation';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(visitor)" />
        </Stack>
      </QueryClientProvider>
    </I18nProvider>
  );
}
