import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

/** Dark theme — the original archive aesthetic */
export const darkColors = {
  bg: '#13171B',
  bg2: '#1A1519',
  card: '#1D242B',
  cardAlt: '#222A31',
  line: 'rgba(255,255,255,0.14)',
  inputBg: '#12181D',
  inputLine: '#3A444C',
  text: '#FFFFFF',
  muted: '#A9B0B6',
  faint: '#6C757C',
  lime: '#C6F04F',
  limeDark: '#10140A',
  limeSoft: 'rgba(198,240,79,0.15)',
  rust: '#7B4332',
  danger: '#FF7B68',
  warn: '#FFB74D',
  info: '#7CC4FF',
  purple: '#D1A3FF',
  // legacy aliases
  ink: '#FFFFFF',
  inkSoft: '#A9B0B6',
  forest: '#13171B',
  forestBright: '#C6F04F',
  moss: '#C6F04F',
  cream: '#13171B',
  paper: '#1D242B',
  mist: '#222A31',
  gold: '#7B4332',
  border: 'rgba(255,255,255,0.14)',
};

/** Light theme — bright, fancy, luxurious museum catalogue aesthetic */
export const lightColors = {
  bg: '#F6F8F4',
  bg2: '#ECEFE8',
  card: '#FFFFFF',
  cardAlt: '#F1F5EE',
  line: 'rgba(0,0,0,0.09)',
  inputBg: '#FFFFFF',
  inputLine: '#CFD9CC',
  text: '#111813',
  muted: '#526255',
  faint: '#8E9E90',
  lime: '#1E7A3E',         // rich prestigious emerald for high-contrast on light
  limeDark: '#FFFFFF',     // white text on emerald primary buttons
  limeSoft: 'rgba(30,122,62,0.12)', // soft tint for selected states
  rust: '#A9442C',
  danger: '#D93829',
  warn: '#C47D08',
  info: '#1A73E8',
  purple: '#8430CE',
  // legacy aliases
  ink: '#111813',
  inkSoft: '#526255',
  forest: '#F6F8F4',
  forestBright: '#1E7A3E',
  moss: '#1E7A3E',
  cream: '#F6F8F4',
  paper: '#FFFFFF',
  mist: '#F1F5EE',
  gold: '#A9442C',
  border: 'rgba(0,0,0,0.09)',
};

export type AppColors = typeof darkColors;

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  colors: AppColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('themeMode')
      .then((saved) => {
        if (mounted && (saved === 'dark' || saved === 'light')) {
          setModeState(saved);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem('themeMode', m).catch(() => {});
  };

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
