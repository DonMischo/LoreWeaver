"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

export const THEMES = ["dark", "light", "midnight", "forest", "sepia", "ocean", "rose", "amber"] as const;
export type Theme = typeof THEMES[number];

export const THEME_LABELS: Record<Theme, string> = {
  dark:     "Dark",
  light:    "Light",
  midnight: "Midnight",
  forest:   "Forest",
  sepia:    "Sepia",
  ocean:    "Ocean",
  rose:     "Rose",
  amber:    "Amber",
};

export const THEME_PREVIEW: Record<Theme, { bg: string; accent: string }> = {
  dark:     { bg: "#141820", accent: "#9b6dff" },
  light:    { bg: "#f8f8f8", accent: "#7c3aed" },
  midnight: { bg: "#0d1117", accent: "#06b6d4" },
  forest:   { bg: "#0d1710", accent: "#22c55e" },
  sepia:    { bg: "#f5f0e8", accent: "#92520a" },
  ocean:    { bg: "#0a1220", accent: "#38bdf8" },
  rose:     { bg: "#1e1f2e", accent: "#f472b6" },
  amber:    { bg: "#140f0a", accent: "#f59e0b" },
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

const NON_DEFAULT_THEMES = THEMES.filter((t) => t !== "dark");

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove(...NON_DEFAULT_THEMES);
  if (theme !== "dark") html.classList.add(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("lw-theme") as Theme | null;
    const t = stored && (THEMES as readonly string[]).includes(stored) ? stored : "dark";
    setThemeState(t as Theme);
    applyTheme(t as Theme);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("lw-theme", t);
    applyTheme(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
