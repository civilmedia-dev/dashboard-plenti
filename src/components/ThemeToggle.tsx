'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('plenti-theme', next);
    setTheme(next);
  }

  const nextLabel = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}`}
      onClick={toggle}
      aria-label={nextLabel}
      title={nextLabel}
      aria-pressed={theme === 'light'}
    >
      <span aria-hidden="true" className="theme-toggle__icon">{theme === 'dark' ? '☀' : '☾'}</span>
      {!compact && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  );
}
