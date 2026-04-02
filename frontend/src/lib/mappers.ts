import type {
  ApiAlert,
  ApiAlertSummary,
  ApiDashboardOverview,
  ApiMapPoint,
  ApiSupplierOverview,
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
  isMapBacked?: boolean;
};

export type KpiItem = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  risk: "low" | "medium" | "high";
};

const FALLBACK_COORDINATES: [number, number] = [0, 0];

function normalizeTimestamp(value?: string | null) {
  if (!value) return "Unknown";
  return value;
}

export function mapApiAlertToUiAlert(alert: ApiAlert): AlertItem {
  return {
    id: alert.alert_id,
    title: alert.title,
    location:
      alert.destination_port ??
      alert.transit_port ??
      alert.origin_port ??
      "Unknown location",
    country: "Unknown",
    region: alert.supplier_region ?? "Unknown",
    businessUnit: alert.business_unit ?? undefined,
    category: alert.category,
    level: alert.level,
    status: alert.status,
    timestamp: normalizeTimestamp(alert.timestamp),
    summary: alert.summary,
    coordinates: FALLBACK_COORDINATES,
    supplierName: alert.supplier_name ?? undefined,
    delayHours: alert.delay_hours ?? undefined,
    weatherRisk: alert.weather_risk ?? undefined,
    portCongestion: alert.port_congestion ?? undefined,
    isMapBacked: false,
  };
}

export function mapApiMapPointToUiAlert(point: ApiMapPoint): AlertItem {
  const hasCoords =
    typeof point.lng === "number" &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lng) &&
    Number.isFinite(point.lat);

  return {
    id: point.alert_id,
    title: point.title,
    location: point.destination_port ?? "Unknown port",
    country: point.country ?? "Unknown",
    region: point.region ?? point.supplier_region ?? "Unknown",
    businessUnit: point.business_unit ?? undefined,
    category: point.category,
    level: point.level,
    status: point.status,
    timestamp: normalizeTimestamp(point.timestamp),
    summary: point.summary,
    coordinates: hasCoords
      ? [point.lng as number, point.lat as number]
      : FALLBACK_COORDINATES,
    supplierName: point.supplier_name ?? undefined,
    delayHours: point.delay_hours ?? undefined,
    weatherRisk: point.weather_risk ?? undefined,
    portCongestion: point.port_congestion ?? undefined,
    isMapBacked: hasCoords,
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
  suppliersOverview: ApiSupplierOverview | null;
}): KpiItem[] {
  const { dashboardOverview, alertSummary, suppliersOverview } = params;

  const totalShipments = dashboardOverview?.total_shipments ?? 0;
  const highRiskShipments = dashboardOverview?.high_risk_shipments ?? 0;
  const delayedPct =
    totalShipments > 0 ? (highRiskShipments / totalShipments) * 100 : 0;

  const globalRiskScore = Math.min(
    100,
    Math.round(
      (suppliersOverview?.avg_risk_score ?? 0) * 0.5 +
        (alertSummary?.critical_alerts ?? 0) * 2 +
        delayedPct * 0.8
    )
  );

  return [
    {
      title: "Global Risk Score",
      value: formatInt(globalRiskScore),
      change: `${alertSummary?.top_category ?? "stable"} focus`,
      trend: globalRiskScore >= 70 ? "up" : globalRiskScore >= 40 ? "neutral" : "down",
      risk: globalRiskScore >= 70 ? "high" : globalRiskScore >= 40 ? "medium" : "low",
    },
    {
      title: "Critical Alerts",
      value: formatInt(alertSummary?.critical_alerts ?? 0),
      change: `${formatInt(alertSummary?.active_alerts ?? 0)} active`,
      trend: (alertSummary?.critical_alerts ?? 0) > 0 ? "up" : "neutral",
      risk:
        (alertSummary?.critical_alerts ?? 0) >= 10
          ? "high"
          : (alertSummary?.critical_alerts ?? 0) >= 4
            ? "medium"
            : "low",
    },
    {
      title: "High-Risk Suppliers",
      value: formatInt(suppliersOverview?.high_risk_suppliers ?? 0),
      change: `${formatInt(suppliersOverview?.total_suppliers ?? 0)} tracked`,
      trend: (suppliersOverview?.high_risk_suppliers ?? 0) > 0 ? "up" : "neutral",
      risk:
        (suppliersOverview?.high_risk_suppliers ?? 0) >= 20
          ? "high"
          : (suppliersOverview?.high_risk_suppliers ?? 0) >= 8
            ? "medium"
            : "low",
    },
    {
      title: "Delayed Shipments %",
      value: formatPercent(delayedPct),
      change: `${formatInt(highRiskShipments)} flagged`,
      trend: delayedPct >= 20 ? "up" : delayedPct >= 10 ? "neutral" : "down",
      risk: delayedPct >= 20 ? "high" : delayedPct >= 10 ? "medium" : "low",
    },
    {
      title: "Avg Time to Recover",
      value: `${Math.max(12, Math.round((dashboardOverview?.avg_delay_hours ?? 0) * 1.8))}h`,
      change: "proxy from delay",
      trend: "neutral",
      risk:
        (dashboardOverview?.avg_delay_hours ?? 0) >= 20
          ? "high"
          : (dashboardOverview?.avg_delay_hours ?? 0) >= 8
            ? "medium"
            : "low",
    },
  ];
}