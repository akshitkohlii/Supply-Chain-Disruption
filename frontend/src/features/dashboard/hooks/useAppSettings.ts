"use client";

import { useEffect, useState } from "react";
import {
  loadAppSettings,
  subscribeToAppSettings,
  type AppSettings,
} from "@/lib/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());

  useEffect(() => subscribeToAppSettings(setSettings), []);

  return settings;
}
