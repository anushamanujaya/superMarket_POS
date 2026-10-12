'use client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Locale, Messages, MESSAGES } from './i18n';

interface Prefs {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Messages;
  dark: boolean;
  toggleDark: () => void;
}
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const l = localStorage.getItem('pos.locale') as Locale | null;
      if (l && l in MESSAGES) setLocaleState(l);
      setDark(localStorage.getItem('pos.dark') === '1');
    } catch {
      /* storage blocked */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.lang = locale;
  }, [dark, locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('pos.locale', l);
    } catch {
      /* ignore */
    }
  };
  const toggleDark = () =>
    setDark((d) => {
      try {
        localStorage.setItem('pos.dark', d ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !d;
    });

  return (
    <Ctx.Provider value={{ locale, setLocale, t: MESSAGES[locale], dark, toggleDark }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('PrefsProvider missing');
  return v;
}
