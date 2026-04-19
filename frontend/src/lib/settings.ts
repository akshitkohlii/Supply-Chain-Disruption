export const SETTINGS_STORAGE_KEY = "supplychain.settings";
export const SETTINGS_UPDATED_EVENT = "supplychain:settings-updated";

export const REGION_OPTIONS = [
  "All Regions",
  "Global",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Middle East",
  "Africa",
] as const;

export const TIME_RANGE_OPTIONS = [
  "Last 24 Hours",
  "Last 7 Days",
  "Last 30 Days",
] as const;

export type RegionOption = (typeof REGION_OPTIONS)[number];
export type TimeRangeOption = (typeof TIME_RANGE_OPTIONS)[number];

export type AppSettings = {
  criticalRiskThreshold: number;
  warningRiskThreshold: number;
  maxAcceptableDelayHours: number;
  enableAlerts: boolean;
  criticalAlertsOnly: boolean;
  emailNotifications: boolean;
  weatherApiEnabled: boolean;
  newsFeedEnabled: boolean;
  supplierSyncEnabled: boolean;
  logisticsFeedEnabled: boolean;
  defaultRegion: RegionOption;
  defaultTimeRange: TimeRangeOption;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  criticalRiskThreshold: 70,
  warningRiskThreshold: 40,
  maxAcceptableDelayHours: 24,
  enableAlerts: true,
  criticalAlertsOnly: false,
  emailNotifications: false,
  weatherApiEnabled: true,
  newsFeedEnabled: true,
  supplierSyncEnabled: true,
  logisticsFeedEnabled: true,
  defaultRegion: "All Regions",
  defaultTimeRange: "Last 24 Hours",
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_APP_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}


export function saveAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent<AppSettings>(SETTINGS_UPDATED_EVENT, { detail: settings })
  );
}

export function subscribeToAppSettings(onChange: (settings: AppSettings) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== SETTINGS_STORAGE_KEY) {
      return;
    }

    onChange(loadAppSettings());
  };

  const handleCustomUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<AppSettings>;
    onChange(customEvent.detail ?? loadAppSettings());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SETTINGS_UPDATED_EVENT, handleCustomUpdate as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      SETTINGS_UPDATED_EVENT,
      handleCustomUpdate as EventListener
    );
  };
}
