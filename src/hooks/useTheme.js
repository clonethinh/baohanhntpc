import { useState, useEffect, useCallback } from 'react';
import { antdLightTheme, antdDarkTheme } from '../theme/antdTheme';

const THEME_KEY = 'ntpc-theme';
const listeners = new Set();

function readTheme() {
  return localStorage.getItem(THEME_KEY) === 'dark';
}

function applyThemeAttrs(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.documentElement.dataset.prefersColorScheme = isDark ? 'dark' : 'light';
}

let currentIsDark = readTheme();

function writeTheme(isDark) {
  if (currentIsDark === isDark) return;
  currentIsDark = isDark;
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  applyThemeAttrs(isDark);
  listeners.forEach(listener => listener(isDark));
}

export function useTheme() {
  const [isDark, setIsDark] = useState(currentIsDark);

  useEffect(() => {
    applyThemeAttrs(currentIsDark);
    listeners.add(setIsDark);

    const onStorage = (event) => {
      if (event.key === THEME_KEY) {
        const next = readTheme();
        if (currentIsDark !== next) {
          currentIsDark = next;
          applyThemeAttrs(next);
          listeners.forEach(listener => listener(next));
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(setIsDark);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    writeTheme(!currentIsDark);
  }, []);

  const theme = isDark ? antdDarkTheme : antdLightTheme;

  return { isDark, toggle, theme };
}
