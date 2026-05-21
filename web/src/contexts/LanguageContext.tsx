"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { type Locale, translate } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with "en" to match the server render, then sync from DB after load.
  const [locale, setLocaleState] = useState<Locale>("en");
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  useEffect(() => {
    if (settings?.language) setLocaleState(settings.language as Locale);
  }, [settings?.language]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    settingsApi.update({ language: l });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
