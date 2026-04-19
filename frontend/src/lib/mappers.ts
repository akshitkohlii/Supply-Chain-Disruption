import type {
  ApiAlert,
  ApiAlertSummary,
  ApiDashboardOverview,
  ApiMapPoint,
} from "./api";
import type { AppSettings } from "./settings";

export type AlertItem = {
  id: string;
  entityType?: "route" | "port";
  entityId?: string;
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
  emergingScore?: number;
  emergingSignals?: Array<{
    signalId: string;
    sourceType: "news" | "weather" | "congestion";
    severity: "low" | "medium" | "high";
    portName?: string;
    impactScore: number;
    title?: string;
  }>;
  finalRiskScore?: number;
  mlRiskScore?: number;
  mlProbability?: number;
  predictedDelayHours?: number;
  mlTopFactors?: string[];
  routeKey?: string;
  originPort?: string;
  destinationPort?: string;
  relatedOriginPort?: string;
  relatedDestinationPort?: string;
  shipmentId?: string;
  anchorPort?: string;
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
  const weatherScore = alert.scores?.weather ?? alert.weather_score ?? 0;
  const newsScore = alert.scores?.news ?? alert.news_score ?? 0;
  const logisticsScore = alert.scores?.logistics ?? alert.logistics_score ?? 0;
  const congestionScore = alert.scores?.congestion ?? alert.congestion_score ?? 0;
  const emergingScore = alert.scores?.emerging ?? alert.emerging_score;
  const finalRiskScore = alert.scores?.final_risk ?? alert.final_risk ?? alert.risk_score;

  return {
    id: alert.alert_id,
    entityType: alert.entity_type,
    entityId: alert.entity_id,
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
    weatherRisk: weatherScore,
    portCongestion: congestionScore,
    newsScore,
    logisticsScore,
    congestionScore,
    emergingScore,
    emergingSignals:
      alert.emerging_impact?.signals?.map((signal) => ({
        signalId: signal.signal_id,
        sourceType: signal.source_type,
        severity: signal.severity,
        portName: signal.port_name,
        impactScore: signal.impact_score,
        title: signal.title,
      })) ?? [],
    finalRiskScore,
    mlRiskScore:
      alert.scores?.ml ?? alert.ml_prediction?.ml_risk_score,
    mlProbability: alert.ml_prediction?.disruption_probability,
    predictedDelayHours: alert.ml_prediction?.predicted_delay_hours,
    mlTopFactors: alert.ml_prediction?.top_factors ?? [],
    routeKey: alert.route_key ?? undefined,
    originPort: alert.origin_port ?? alert.related_origin_port ?? undefined,
    destinationPort:
      alert.destination_port ??
      alert.related_destination_port ??
      undefined,
    relatedOriginPort: alert.related_origin_port ?? undefined,
    relatedDestinationPort:
      alert.related_destination_port ?? alert.destination_port ?? undefined,
    shipmentId: alert.shipment_id ?? undefined,
    anchorPort: alert.destination_port ?? alert.origin_port,
    isMapBacked: true,
  };
}

export function applyAlertThresholds(
  alert: AlertItem,
  settings: AppSettings
): AlertItem {
  const score = alert.finalRiskScore;

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return alert;
  }

  const level: AlertItem["level"] =
    score >= settings.criticalRiskThreshold
      ? "critical"
      : score >= settings.warningRiskThreshold
        ? "warning"
        : "stable";

  return { ...alert, level };
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
    mlRiskScore: undefined,
    mlProbability: undefined,
    predictedDelayHours: undefined,
    mlTopFactors: [],
    routeKey: undefined,
    originPort: undefined,
    destinationPort: point.name,
    anchorPort: point.name,
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
      title: "Network Risk Index",
      value: formatInt(Math.round(globalRiskScore)),
      change: `${alertSummary?.top_category ?? "stable"} focus`,
      trend: globalRiskScore >= 70 ? "up" : globalRiskScore >= 40 ? "neutral" : "down",
      risk: globalRiskScore >= 70 ? "high" : globalRiskScore >= 40 ? "medium" : "low",
    },
    {
      title: "Active Critical Alerts",
      value: formatInt(criticalAlerts),
      change: `${formatInt(alertSummary?.active_alerts ?? 0)} active`,
      trend: criticalAlerts > 0 ? "up" : "neutral",
      risk: criticalAlerts >= 10 ? "high" : criticalAlerts >= 4 ? "medium" : "low",
    },
    {
      title: "Routes In Warning/Critical State",
      value: formatInt(highRiskRoutes),
      change: "latest route snapshots",
      trend: highRiskRoutes > 0 ? "up" : "neutral",
      risk: highRiskRoutes >= 20 ? "high" : highRiskRoutes >= 8 ? "medium" : "low",
    },
    {
      title: "Shipment Delay Exposure",
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
      title: "Average Route Delay",
      value: `${avgRouteDelayHours.toFixed(1)}h`,
      change: `${avgRouteDelayHours.toFixed(1)}h avg delay`,
      trend: "neutral",
      risk:
        avgRouteDelayHours >= 20 ? "high" : avgRouteDelayHours >= 8 ? "medium" : "low",
    },
  ];
}
