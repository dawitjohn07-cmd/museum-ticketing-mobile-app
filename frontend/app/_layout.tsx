import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../src/lib/i18n/useTranslation';
import { AuthProvider } from '../src/hooks/useAuth';
import { ThemeProvider, useTheme } from '../src/lib/theme/useTheme';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function AppStack() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppStack />
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
