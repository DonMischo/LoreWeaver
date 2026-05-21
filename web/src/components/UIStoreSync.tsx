"use client";

import { useEffect } from "react";
import { useSettings } from "@/store/queries";
import { useUIStore } from "@/store/ui";

/**
 * Mounted once at app root — seeds the Zustand UI store from the DB settings
 * on first load, and re-syncs whenever settings are refetched.
 */
export function UIStoreSync() {
  const { data: settings } = useSettings();
  const initFromSettings = useUIStore((s) => s.initFromSettings);

  useEffect(() => {
    if (settings) initFromSettings(settings);
  }, [settings, initFromSettings]);

  return null;
}
