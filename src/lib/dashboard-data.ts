import {
  PanelLeft,
  Settings,
  Truck,
} from "lucide-react";

export const navItems = [
  { label: "Overview", icon: PanelLeft },
  { label: "Logistics", icon: Truck },
  { label: "Settings", icon: Settings },
];

export type RiskLevel = "stable" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertCategory =
  | "supplier"
  | "port"
  | "climate"
  | "geo"
  | "logistics";

export type AlertItem = {
  id: string;
  title: string;
  location: string;
  country: string;
  category: AlertCategory;
  level: RiskLevel;
  status: AlertStatus;
  timestamp: string;
  summary: string;
  coordinates: [number, number];
};

export const alerts: AlertItem[] = [
  {
    id: "alt-001",
    title: "Port congestion rising",
    location: "Los Angeles Port",
    country: "USA",
    category: "port",
    level: "warning",
    status: "active",
    timestamp: "10 min ago",
    summary: "Container backlog increased by 18% over baseline.",
    coordinates: [-118.2641, 33.7405],
  },
  {
    id: "alt-002",
    title: "Labor strike risk",
    location: "Rotterdam Port",
    country: "Netherlands",
    category: "logistics",
    level: "warning",
    status: "active",
    timestamp: "25 min ago",
    summary: "Union negotiations stalled; moderate disruption probability.",
    coordinates: [4.4777, 51.9244],
  },
  {
    id: "alt-003",
    title: "Monsoon-linked disruption risk",
    location: "Mumbai Hub",
    country: "India",
    category: "climate",
    level: "critical",
    status: "active",
    timestamp: "40 min ago",
    summary: "Severe rainfall forecast impacting inland movement.",
    coordinates: [72.8777, 19.076],
  },
  {
    id: "alt-004",
    title: "Supplier instability signal",
    location: "Singapore",
    country: "Singapore",
    category: "supplier",
    level: "stable",
    status: "active",
    timestamp: "1 hr ago",
    summary: "Procurement sentiment weakened, but no confirmed disruption.",
    coordinates: [103.8198, 1.3521],
  },
  {
    id: "alt-005",
    title: "Customs clearance slowdown",
    location: "Santos Port",
    country: "Brazil",
    category: "geo",
    level: "warning",
    status: "acknowledged",
    timestamp: "2 hrs ago",
    summary: "Border processing delays affecting outbound shipments.",
    coordinates: [-46.3289, -23.9608],
  },
];

export type KpiTrend = "up" | "down" | "neutral";

export type KpiItem = {
  title: string;
  value: string;
  change: string;
  trend: KpiTrend;
  series: number[];
};

const criticalAlerts = alerts.filter((a) => a.level === "critical").length;
const warningAlerts = alerts.filter((a) => a.level === "warning").length;
const totalAlerts = alerts.length;

const globalRiskScore = Math.min(
  100,
  Math.round(criticalAlerts * 40 + warningAlerts * 20 + totalAlerts * 5)
);

const highRiskSuppliers = alerts.filter(
  (a) =>
    (a.category === "supplier" || a.category === "geo") &&
    (a.level === "warning" || a.level === "critical")
).length;

const delaySignals = alerts.filter(
  (a) => a.category === "logistics" || a.category === "port"
).length;

const delayedShipmentPercent = Math.min(
  100,
  Math.round((delaySignals / totalAlerts) * 100 + warningAlerts * 3)
);

const avgRecoveryDays = (
  2 + criticalAlerts * 1.5 + warningAlerts * 0.7
).toFixed(1);

export const kpis: KpiItem[] = [
  {
    title: "Global Risk Score",
    value: `${globalRiskScore}`,
    change: `${criticalAlerts} critical`,
    trend: "up",
    series: [48, 52, 57, 61, 66, 72, 78, globalRiskScore],
  },
  {
    title: "Critical Alerts",
    value: `${criticalAlerts}`,
    change: `${warningAlerts} warning`,
    trend: criticalAlerts > 0 ? "up" : "neutral",
    series: [0, 0, 1, 1, 2, 1, 1, criticalAlerts],
  },
  {
    title: "High-Risk Suppliers",
    value: `${highRiskSuppliers}`,
    change: "Supplier instability",
    trend: highRiskSuppliers > 0 ? "up" : "neutral",
    series: [0, 1, 1, 2, 2, 2, 1, highRiskSuppliers],
  },
  {
    title: "Delayed Shipments %",
    value: `${delayedShipmentPercent}%`,
    change: "Logistics slowdown",
    trend: delayedShipmentPercent > 20 ? "up" : "neutral",
    series: [11, 13, 14, 16, 18, 20, 23, delayedShipmentPercent],
  },
  {
    title: "Avg Time to Recover",
    value: `${avgRecoveryDays} days`,
    change: "Estimated",
    trend: "up",
    series: [2.1, 2.4, 2.8, 3.0, 3.4, 3.6, 3.9, Number(avgRecoveryDays)],
  },
];

export type EmergingSignal = {
  id: string;
  label: string;
  value: number;       // intensity score (0–100)
  trend: "up" | "down" | "stable";
};

export const emergingSignals: EmergingSignal[] = [
  {
    id: "sig-001",
    label: "Sentiment Spike",
    value: 78,
    trend: "up",
  },
  {
    id: "sig-002",
    label: "Weather Anomaly",
    value: 65,
    trend: "up",
  },
  {
    id: "sig-003",
    label: "Labor Unrest",
    value: 42,
    trend: "stable",
  },
  {
    id: "sig-004",
    label: "Customs Delay",
    value: 58,
    trend: "down",
  },
];