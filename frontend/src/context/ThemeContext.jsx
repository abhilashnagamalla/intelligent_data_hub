import { createContext, useState, useEffect } from 'react';

/* eslint-disable react-refresh/only-export-components */
export const ThemeContext = createContext();

function activeUserThemeKey() {
  if (typeof window === 'undefined') return 'darkMode:guest';
  try {
    const raw = window.localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    const userId = user?.id || user?.email || 'guest';
    return `darkMode:${userId}`;
  } catch {
    return 'darkMode:guest';
  }
}

function readThemePreference() {
  if (typeof window === 'undefined') return false;
  const key = activeUserThemeKey();
  return window.localStorage.getItem(key) === 'true';
}

export default function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const isDark = readThemePreference();
    document.documentElement.classList.toggle('dark', isDark);
    return isDark;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    const key = activeUserThemeKey();
    localStorage.setItem(key, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleAuthChange = () => {
      const isDark = readThemePreference();
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    };

    window.addEventListener('idh-auth-changed', handleAuthChange);
    return () => window.removeEventListener('idh-auth-changed', handleAuthChange);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    const key = activeUserThemeKey();
    localStorage.setItem(key, String(newDarkMode));
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
