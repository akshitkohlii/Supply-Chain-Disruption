import type { AlertItem } from "@/lib/mappers";
import type { AppSettings } from "@/lib/settings";
import type {
  DashboardFiltersState,
  RiskLevelFilter,
  ScopeFilter,
  StatusFilter,
} from "./types";

function levelRank(level: AlertItem["level"]) {
  if (level === "critical") return 3;
  if (level === "warning") return 2;
  return 1;
}

export function scoreAlert(alert: AlertItem) {
  const finalRisk = alert.finalRiskScore ?? 0;
  const ml = alert.mlRiskScore ?? 0;
  const weather = alert.weatherRisk ?? 0;
  const news = alert.newsScore ?? 0;
  const logistics = alert.logisticsScore ?? 0;
  const congestion = alert.congestionScore ?? alert.portCongestion ?? 0;

  return (
    levelRank(alert.level) * 1000 +
    finalRisk * 10 +
    ml * 5 +
    weather +
    news +
    logistics +
    congestion
  );
}

export function dedupeHighestRiskPerAnchorPort(alerts: AlertItem[]) {
  const bestByPort = new Map<string, AlertItem>();

  for (const alert of alerts) {
    const anchor =
      alert.anchorPort ??
      alert.destinationPort ??
      alert.originPort ??
      alert.location ??
      "Unknown";

    const country = alert.country ?? "Unknown";
    const key = `${anchor}|${country}`;

    const existing = bestByPort.get(key);
    if (!existing || scoreAlert(alert) > scoreAlert(existing)) {
      bestByPort.set(key, alert);
    }
  }

  return [...bestByPort.values()].sort((a, b) => scoreAlert(b) - scoreAlert(a));
}

export function matchesSearchFilter(alert: AlertItem, normalizedSearch: string) {
  if (!normalizedSearch) return true;

  const haystack = [
    alert.title,
    alert.location,
    alert.country,
    alert.region,
    alert.businessUnit,
    alert.category,
    alert.summary,
    alert.status,
    alert.supplierName,
    alert.originPort,
    alert.destinationPort,
    alert.anchorPort,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

export function matchesRiskLevelFilter(
  alert: AlertItem,
  riskLevel: RiskLevelFilter
) {
  if (riskLevel === "All Levels") return true;
  if (riskLevel === "Critical") return alert.level === "critical";
  if (riskLevel === "Warning") return alert.level === "warning";
  if (riskLevel === "Stable") return alert.level === "stable";
  return true;
}

export function matchesRegionFilter(alert: AlertItem, region: string) {
  if (!region || region === "All Regions") return true;

  const selected = region.toLowerCase();
  return (
    alert.region?.toLowerCase() === selected ||
    alert.country?.toLowerCase() === selected
  );
}

export function matchesBusinessUnitFilter(
  alert: AlertItem,
  businessUnit: string
) {
  if (!businessUnit || businessUnit === "All Units") return true;
  return (alert.businessUnit ?? "").toLowerCase() === businessUnit.toLowerCase();
}

export function matchesScopeFilter(
  alert: AlertItem,
  scope: ScopeFilter,
  userRegion: string
) {
  if (scope === "Global") return true;
  if (!userRegion || userRegion === "All Regions") {
    return Boolean(alert.region && alert.region !== "Global");
  }

  return matchesRegionFilter(alert, userRegion);
}

export function matchesStatusFilter(alert: AlertItem, status: StatusFilter) {
  if (status === "All") return true;
  if (status === "Alerts") return alert.status === "active";
  if (status === "Acknowledged") return alert.status === "acknowledged";
  if (status === "Resolved") return alert.status === "resolved";
  return true;
}

export function filterAlerts(
  alerts: AlertItem[],
  filters: DashboardFiltersState
): AlertItem[] {
  const normalizedSearch = filters.debouncedSearch.trim().toLowerCase();

  return alerts.filter((alert) => {
    const matchesSearch = matchesSearchFilter(alert, normalizedSearch);
    const matchesLayer =
      filters.activeLayer === "all" ? true : alert.category === filters.activeLayer;
    const matchesLegendLevel =
      filters.activeLevel === "all" ? true : alert.level === filters.activeLevel;
    const matchesRiskLevel = matchesRiskLevelFilter(alert, filters.riskLevel);
    const matchesRegion = matchesRegionFilter(alert, filters.region);
    const matchesBusinessUnit = matchesBusinessUnitFilter(
      alert,
      filters.businessUnit
    );
    const matchesScope = matchesScopeFilter(
      alert,
      filters.scope,
      filters.userRegion
    );
    const matchesStatus = matchesStatusFilter(alert, filters.status);

    return (
      matchesSearch &&
      matchesLayer &&
      matchesLegendLevel &&
      matchesRiskLevel &&
      matchesRegion &&
      matchesBusinessUnit &&
      matchesScope &&
      matchesStatus
    );
  });
}

export function buildVisibleAlerts(
  filteredAlerts: AlertItem[],
  settings: AppSettings
) {
  if (!settings.enableAlerts) {
    return [];
  }

  return filteredAlerts.filter((alert) => {
    if (alert.status === "resolved") {
      return false;
    }

    if (settings.criticalAlertsOnly) {
      return alert.level === "critical";
    }

    return alert.level !== "stable";
  });
}

export function buildMapVisibleAlerts(
  visibleAlerts: AlertItem[],
  selectedAlert: AlertItem | null
) {
  const mapCapable = visibleAlerts.filter((alert) => {
    const [lng, lat] = alert.coordinates;
    return Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0);
  });

  const deduped = dedupeHighestRiskPerAnchorPort(mapCapable);

  if (!selectedAlert) return deduped;

  const key = `${
    selectedAlert.anchorPort ??
    selectedAlert.destinationPort ??
    selectedAlert.location
  }|${selectedAlert.country}`;

  const filtered = deduped.filter(
    (a) =>
      `${
        a.anchorPort ?? a.destinationPort ?? a.location
      }|${a.country}` !== key
  );

  const [lng, lat] = selectedAlert.coordinates;
  if (Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0)) {
    return [...filtered, selectedAlert];
  }

  return filtered;
}

export function buildNotificationAlerts(
  alerts: AlertItem[],
  settings: AppSettings
) {
  return buildVisibleAlerts(alerts, settings).filter(
    (alert) => alert.status === "active"
  );
}
