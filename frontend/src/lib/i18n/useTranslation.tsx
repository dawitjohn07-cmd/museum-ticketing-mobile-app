import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en/common.json';
import am from './locales/am/common.json';
import { setGlobalLanguage } from '../api/client';

const translations = { en, am } as const;
type TranslationKey = keyof typeof en;
type LocaleType = 'en' | 'am';

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

interface I18nContextType {
  locale: LocaleType;
  setLocale: (l: LocaleType) => void;
  t: (key: TranslationKey | (string & {}), values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleType>('en');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('locale')
      .then((saved) => {
        if (!mounted) return;
        if (saved === 'en' || saved === 'am') {
          setLocaleState(saved);
          setGlobalLanguage(saved);
        } else {
          setGlobalLanguage('en');
        }
      })
      .catch(() => {
        if (mounted) {
          setGlobalLanguage('en');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = (l: LocaleType) => {
    setLocaleState(l);
    setGlobalLanguage(l);
    void AsyncStorage.setItem('locale', l).catch(() => {
      // The in-memory preference remains active if browser/device storage is unavailable.
    });
  };

  const t = (
    key: TranslationKey | (string & {}),
    values?: Record<string, string | number>
  ): string => {
    const enTranslations: Record<string, string> = translations.en;
    const localeTranslations: Record<string, string> = translations[locale] ?? enTranslations;
    const raw = localeTranslations[key] ?? enTranslations[key] ?? humanizeKey(key);
    if (!values) return raw;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
      raw
    );
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}
