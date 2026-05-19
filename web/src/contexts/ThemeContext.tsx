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

const THEME_VARS: Record<Theme, Record<string, string>> = {
  dark: {
    "--background": "222 20% 8%",       "--foreground": "210 40% 95%",
    "--card": "222 20% 11%",            "--card-foreground": "210 40% 95%",
    "--popover": "222 20% 11%",         "--popover-foreground": "210 40% 95%",
    "--primary": "262 80% 65%",         "--primary-foreground": "0 0% 100%",
    "--secondary": "222 20% 16%",       "--secondary-foreground": "210 40% 95%",
    "--muted": "222 20% 16%",           "--muted-foreground": "215 20% 55%",
    "--accent": "262 80% 65%",          "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "222 20% 18%",          "--input": "222 20% 18%",
    "--ring": "262 80% 65%",
  },
  light: {
    "--background": "0 0% 98%",         "--foreground": "222 20% 8%",
    "--card": "0 0% 100%",              "--card-foreground": "222 20% 8%",
    "--popover": "0 0% 100%",           "--popover-foreground": "222 20% 8%",
    "--primary": "262 80% 55%",         "--primary-foreground": "0 0% 100%",
    "--secondary": "210 20% 93%",       "--secondary-foreground": "222 20% 8%",
    "--muted": "210 20% 93%",           "--muted-foreground": "215 16% 47%",
    "--accent": "262 80% 55%",          "--accent-foreground": "0 0% 100%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "220 13% 88%",          "--input": "220 13% 88%",
    "--ring": "262 80% 55%",
  },
  midnight: {
    "--background": "216 14% 7%",       "--foreground": "210 14% 89%",
    "--card": "216 13% 10%",            "--card-foreground": "210 14% 89%",
    "--popover": "216 13% 10%",         "--popover-foreground": "210 14% 89%",
    "--primary": "186 96% 42%",         "--primary-foreground": "220 14% 8%",
    "--secondary": "217 12% 14%",       "--secondary-foreground": "210 14% 89%",
    "--muted": "217 12% 14%",           "--muted-foreground": "217 10% 52%",
    "--accent": "186 96% 42%",          "--accent-foreground": "220 14% 8%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "217 11% 18%",          "--input": "217 11% 18%",
    "--ring": "186 96% 42%",
  },
  forest: {
    "--background": "150 18% 7%",       "--foreground": "120 8% 88%",
    "--card": "150 15% 10%",            "--card-foreground": "120 8% 88%",
    "--popover": "150 15% 10%",         "--popover-foreground": "120 8% 88%",
    "--primary": "142 69% 45%",         "--primary-foreground": "150 18% 7%",
    "--secondary": "148 12% 14%",       "--secondary-foreground": "120 8% 88%",
    "--muted": "148 12% 14%",           "--muted-foreground": "140 8% 50%",
    "--accent": "142 69% 45%",          "--accent-foreground": "150 18% 7%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "148 10% 18%",          "--input": "148 10% 18%",
    "--ring": "142 69% 45%",
  },
  sepia: {
    "--background": "40 28% 94%",       "--foreground": "25 24% 18%",
    "--card": "38 22% 90%",             "--card-foreground": "25 24% 18%",
    "--popover": "38 22% 90%",          "--popover-foreground": "25 24% 18%",
    "--primary": "25 68% 38%",          "--primary-foreground": "40 28% 96%",
    "--secondary": "36 18% 83%",        "--secondary-foreground": "25 24% 18%",
    "--muted": "36 18% 83%",            "--muted-foreground": "30 12% 46%",
    "--accent": "25 68% 38%",           "--accent-foreground": "40 28% 96%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "34 16% 78%",           "--input": "34 16% 78%",
    "--ring": "25 68% 38%",
  },
  ocean: {
    "--background": "220 30% 8%",       "--foreground": "210 28% 92%",
    "--card": "220 26% 11%",            "--card-foreground": "210 28% 92%",
    "--popover": "220 26% 11%",         "--popover-foreground": "210 28% 92%",
    "--primary": "204 90% 54%",         "--primary-foreground": "220 30% 8%",
    "--secondary": "220 20% 15%",       "--secondary-foreground": "210 28% 92%",
    "--muted": "220 20% 15%",           "--muted-foreground": "215 14% 50%",
    "--accent": "204 90% 54%",          "--accent-foreground": "220 30% 8%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "220 18% 19%",          "--input": "220 18% 19%",
    "--ring": "204 90% 54%",
  },
  rose: {
    "--background": "231 15% 12%",      "--foreground": "60 4% 94%",
    "--card": "231 13% 16%",            "--card-foreground": "60 4% 94%",
    "--popover": "231 13% 16%",         "--popover-foreground": "60 4% 94%",
    "--primary": "326 100% 72%",        "--primary-foreground": "231 15% 12%",
    "--secondary": "232 12% 20%",       "--secondary-foreground": "60 4% 94%",
    "--muted": "232 12% 20%",           "--muted-foreground": "225 8% 54%",
    "--accent": "326 100% 72%",         "--accent-foreground": "231 15% 12%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "232 10% 24%",          "--input": "232 10% 24%",
    "--ring": "326 100% 72%",
  },
  amber: {
    "--background": "20 16% 8%",        "--foreground": "40 18% 90%",
    "--card": "22 14% 11%",             "--card-foreground": "40 18% 90%",
    "--popover": "22 14% 11%",          "--popover-foreground": "40 18% 90%",
    "--primary": "38 94% 52%",          "--primary-foreground": "20 16% 8%",
    "--secondary": "22 12% 15%",        "--secondary-foreground": "40 18% 90%",
    "--muted": "22 12% 15%",            "--muted-foreground": "30 10% 50%",
    "--accent": "38 94% 52%",           "--accent-foreground": "20 16% 8%",
    "--destructive": "0 72% 51%",       "--destructive-foreground": "0 0% 100%",
    "--border": "24 10% 18%",           "--input": "24 10% 18%",
    "--ring": "38 94% 52%",
  },
};

function applyTheme(theme: Theme) {
  const vars = THEME_VARS[theme];
  const html = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => html.style.setProperty(k, v));
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
