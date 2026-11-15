'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

function ColorSchemeMetaSync() {
  const { theme } = useTheme();

  React.useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="color-scheme"]'
    );
    if (!meta) return;
    if (theme === 'dark' || theme === 'light') {
      meta.content = theme;
      try {
        localStorage.setItem('color-scheme', theme);
      } catch {}
    } else {
      meta.content = 'light dark';
      try {
        localStorage.removeItem('color-scheme');
      } catch {}
    }
  }, [theme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ColorSchemeMetaSync />
      {children}
    </NextThemesProvider>
  );
}
