import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme } from '../theme/lightTheme';
import { darkTheme } from '../theme/darkTheme';

const ThemeModeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  setMode: () => {},
  isDark: false,
});

const THEME_STORAGE_KEY = 'medicare_theme_mode';

export const ThemeModeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Respect system preference
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleTheme = () => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setMode = (newMode) => {
    if (newMode === 'light' || newMode === 'dark') {
      setModeState(newMode);
    }
  };

  const currentTheme = useMemo(() => {
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      setMode,
      isDark: mode === 'dark',
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
};

export default ThemeModeProvider;
