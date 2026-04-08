import type {
  ApiAlert,
  ApiAlertSummary,
  ApiDashboardOverview,
  ApiMapPoint,
} from "./api";

export type AlertItem = {
  id: string;
  title: string;
  location: string;
  country: string;
  region?: string;
  businessUnit?: string;
  category: "supplier" | "port" | "climate" | "geo" | "logistics";
  level: "stable" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  timestamp: string;
  summary: string;
  coordinates: [number, number];
  supplierName?: string;
  delayHours?: number;
  weatherRisk?: number;
  portCongestion?: number;
  newsScore?: number;
  logisticsScore?: number;
  congestionScore?: number;
  finalRiskScore?: number;
  isMapBacked?: boolean;
};

export type KpiItem = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  risk: "low" | "medium" | "high";
};

function normalizeTimestamp(value?: string | null) {
  if (!value) return "Unknown";
  return value;
}

function hasValidCoordinates(
  point: ApiMapPoint
): point is ApiMapPoint & { lng: number; lat: number } {
  return (
    typeof point.lng === "number" &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lng) &&
    Number.isFinite(point.lat)
  );
}

export function mapApiAlertToUiAlert(alert: ApiAlert): AlertItem {
  return {
    id: alert.alert_id,
    title: alert.title,
    location:
      alert.location ||
      [alert.origin_port, alert.destination_port].filter(Boolean).join(" → ") ||
      "Unknown route",
    country: alert.country ?? "Unknown",
    region: "Global",
    businessUnit: undefined,
    category: alert.category,
    level: alert.level,
    status: alert.status,
    timestamp: normalizeTimestamp(alert.timestamp),
    summary: alert.summary,
    coordinates: [
      typeof alert.lng === "number" ? alert.lng : 0,
      typeof alert.lat === "number" ? alert.lat : 0,
    ],
    supplierName: undefined,
    delayHours: undefined,
    weatherRisk: alert.scores?.weather,
    portCongestion: alert.scores?.congestion,
    newsScore: alert.scores?.news,
    logisticsScore: alert.scores?.logistics,
    congestionScore: alert.scores?.congestion,
    finalRiskScore: alert.scores?.final_risk,
    isMapBacked: true,
  };
}

export function mapApiMapPointToUiAlert(point: ApiMapPoint): AlertItem | null {
  if (!hasValidCoordinates(point)) {
    return null;
  }

  const mappedLevel: AlertItem["level"] =
    point.level === "critical"
      ? "critical"
      : point.level === "warning"
        ? "warning"
        : "stable";

  const mappedCategory: AlertItem["category"] =
    point.weatherScore >= point.newsScore && point.weatherScore > 0
      ? "climate"
      : point.newsScore > 0
        ? "geo"
        : "port";

  return {
    id: point.id,
    title: point.name,
    location: point.name,
    country: point.country ?? "Unknown",
    region: "Global",
    businessUnit: undefined,
    category: mappedCategory,
    level: mappedLevel,
    status: "active",
    timestamp: "Live",
    summary: point.summary,
    coordinates: [point.lng, point.lat],
    supplierName: undefined,
    delayHours: undefined,
    weatherRisk: point.weatherScore,
    portCongestion: 0,
    newsScore: point.newsScore,
    logisticsScore: undefined,
    congestionScore: undefined,
    finalRiskScore: undefined,
    isMapBacked: true,
  };
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatInt(value: number) {
  return Intl.NumberFormat("en-US").format(value);
}

export function buildDashboardKpisFromApi(params: {
  dashboardOverview: ApiDashboardOverview | null;
  alertSummary: ApiAlertSummary | null;
}): KpiItem[] {
  const { dashboardOverview, alertSummary } = params;

  const globalRiskScore = dashboardOverview?.globalRiskScore ?? 0;
  const criticalAlerts = dashboardOverview?.criticalAlerts ?? 0;
  const highRiskRoutes = dashboardOverview?.highRiskRoutes ?? 0;
  const delayedShipmentsPercent = dashboardOverview?.delayedShipmentsPercent ?? 0;
  const avgRouteDelayHours = dashboardOverview?.avgRouteDelayHours ?? 0;

  return [
    {
      title: "Global Risk Score",
      value: formatInt(Math.round(globalRiskScore)),
      change: `${alertSummary?.top_category ?? "stable"} focus`,
      trend: globalRiskScore >= 70 ? "up" : globalRiskScore >= 40 ? "neutral" : "down",
      risk: globalRiskScore >= 70 ? "high" : globalRiskScore >= 40 ? "medium" : "low",
    },
    {
      title: "Critical Alerts",
      value: formatInt(criticalAlerts),
      change: `${formatInt(alertSummary?.active_alerts ?? 0)} active`,
      trend: criticalAlerts > 0 ? "up" : "neutral",
      risk: criticalAlerts >= 10 ? "high" : criticalAlerts >= 4 ? "medium" : "low",
    },
    {
      title: "High-Risk Routes",
      value: formatInt(highRiskRoutes),
      change: "latest route snapshots",
      trend: highRiskRoutes > 0 ? "up" : "neutral",
      risk: highRiskRoutes >= 20 ? "high" : highRiskRoutes >= 8 ? "medium" : "low",
    },
    {
      title: "Delayed Shipments %",
      value: formatPercent(delayedShipmentsPercent),
      change: "from shipment baseline",
      trend:
        delayedShipmentsPercent >= 20
          ? "up"
          : delayedShipmentsPercent >= 10
            ? "neutral"
            : "down",
      risk:
        delayedShipmentsPercent >= 20
          ? "high"
          : delayedShipmentsPercent >= 10
            ? "medium"
            : "low",
    },
    {
      title: "Avg Time to Recover",
      value: `${Math.max(12, Math.round(avgRouteDelayHours * 1.8))}h`,
      change: `${avgRouteDelayHours.toFixed(1)}h avg delay`,
      trend: "neutral",
      risk:
        avgRouteDelayHours >= 20 ? "high" : avgRouteDelayHours >= 8 ? "medium" : "low",
    },
  ];
}