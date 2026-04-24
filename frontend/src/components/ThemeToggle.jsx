import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';

const STORAGE_KEY = 'wm-theme';

export const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const initTheme = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  const theme = saved || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  return theme;
};

export const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => initTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Переключить тему"
      data-testid="theme-toggle"
      className="h-9 w-9"
    >
      {theme === 'dark'
        ? <Sun className="h-4 w-4" />
        : <Moon className="h-4 w-4" />}
    </Button>
  );
};

export default ThemeToggle;
