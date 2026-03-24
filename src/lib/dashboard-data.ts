import {
  LayoutGrid,
  Factory,
  Truck,
  LineChart,
  Settings,
} from "lucide-react";

export const navItems = [
  { label: "Overview", icon: LayoutGrid, href: "/" },
  { label: "Suppliers", icon: Factory, href: "/suppliers" },
  { label: "Logistics", icon: Truck, href: "/logistics" },
  { label: "Analytics", icon: LineChart, href: "/analytics" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export const utilityNavItems = [
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

export type KpiRisk = "low" | "medium" | "high";

export type KpiItem = {
  title: string;
  value: string;
  change: string;
  changeValue: number;
  changeLabel: string;
  trend: "up" | "down" | "neutral";
  risk: KpiRisk;
  series: number[];
};

export const dashboardKpis: KpiItem[] = [
  {
    title: "Global Risk Score",
    value: "72",
    change: "+3.2%",
    changeValue: 3.2,
    changeLabel: "vs last week",
    trend: "up",
    risk: "high",
    series: [61, 64, 66, 68, 67, 69, 71, 72],
  },
  {
    title: "Critical Alerts",
    value: "1",
    change: "+0",
    changeValue: 0,
    changeLabel: "active criticals",
    trend: "neutral",
    risk: "medium",
    series: [0, 1, 1, 2, 1, 1, 1, 1],
  },
  {
    title: "High-Risk Suppliers",
    value: "14",
    change: "+2",
    changeValue: 2,
    changeLabel: "vs last month",
    trend: "up",
    risk: "medium",
    series: [10, 11, 11, 12, 12, 13, 13, 14],
  },
  {
    title: "Delayed Shipments %",
    value: "18%",
    change: "-1.5%",
    changeValue: -1.5,
    changeLabel: "vs yesterday",
    trend: "down",
    risk: "medium",
    series: [23, 22, 21, 20, 20, 19, 18.5, 18],
  },
  {
    title: "Avg Time to Recover",
    value: "4.2 days",
    change: "-0.4d",
    changeValue: -0.4,
    changeLabel: "vs last month",
    trend: "down",
    risk: "low",
    series: [5.4, 5.1, 4.9, 4.8, 4.6, 4.5, 4.3, 4.2],
  },
];

function getRiskFromCount(
  count: number,
  highThreshold = 4,
  mediumThreshold = 2
): KpiRisk {
  if (count >= highThreshold) return "high";
  if (count >= mediumThreshold) return "medium";
  return "low";
}

export function buildDashboardKpis(alerts: AlertItem[]): KpiItem[] {
  const criticalAlerts = alerts.filter(
    (a) => a.level === "critical" && a.status === "active"
  ).length;

  return dashboardKpis.map((kpi) => {
    if (kpi.title !== "Critical Alerts") return kpi;

    return {
      ...kpi,
      value: `${criticalAlerts}`,
      change: criticalAlerts > 0 ? `+${criticalAlerts}` : "+0",
      changeValue: criticalAlerts,
      changeLabel: "active criticals",
      trend: criticalAlerts > 0 ? "up" : "neutral",
      risk: getRiskFromCount(criticalAlerts, 3, 1),
      series: [0, 0, 1, 1, 2, 1, 1, criticalAlerts],
    };
  });
}

export type EmergingSignal = {
  id: string;
  label: string;
  value: number;
  trend: "up" | "down" | "stable";
};

export const emergingSignals: EmergingSignal[] = [
  { id: "sig-001", label: "Sentiment Spike", value: 78, trend: "up" },
  { id: "sig-002", label: "Weather Anomaly", value: 65, trend: "up" },
  { id: "sig-003", label: "Labor Unrest", value: 42, trend: "stable" },
  { id: "sig-004", label: "Customs Delay", value: 58, trend: "down" },
];

export type RootCauseItem = {
  label: string;
  value: number;
};

export type RightRailDetail = {
  alertId: string;
  entity: string;
  riskScore: number;
  confidence: number;
  impactedLanes: number;
  affectedArea: string;
  etaImpact: string;
  rootCauses: RootCauseItem[];
};

export const rightRailDetails: RightRailDetail[] = [
  {
    alertId: "alt-001",
    entity: "Los Angeles Port Cluster",
    riskScore: 74,
    confidence: 82,
    impactedLanes: 12,
    affectedArea: "West Coast port operations and container throughput",
    etaImpact: "12–36 hours probable delay on outbound movement",
    rootCauses: [
      { label: "Port Congestion", value: 81 },
      { label: "Vessel Backlog", value: 69 },
      { label: "Terminal Delay", value: 61 },
    ],
  },
  {
    alertId: "alt-002",
    entity: "Rotterdam Transport Corridor",
    riskScore: 71,
    confidence: 76,
    impactedLanes: 9,
    affectedArea: "Carrier network and European transportation execution",
    etaImpact: "8–24 hours service instability",
    rootCauses: [
      { label: "Labor Unrest", value: 78 },
      { label: "Carrier Disruption", value: 66 },
      { label: "Transit Delay", value: 59 },
    ],
  },
  {
    alertId: "alt-003",
    entity: "Mumbai Inland Distribution Hub",
    riskScore: 91,
    confidence: 88,
    impactedLanes: 16,
    affectedArea: "Regional transportation and inland movement",
    etaImpact: "24–72 hours delay for exposed lanes",
    rootCauses: [
      { label: "Weather Severity", value: 92 },
      { label: "Route Exposure", value: 73 },
      { label: "Inland Movement Risk", value: 68 },
    ],
  },
  {
    alertId: "alt-004",
    entity: "Singapore Supplier Network",
    riskScore: 46,
    confidence: 69,
    impactedLanes: 4,
    affectedArea: "Upstream sourcing and supplier continuity",
    etaImpact: "Low to moderate near-term delay risk",
    rootCauses: [
      { label: "Supplier Health", value: 54 },
      { label: "Procurement Volatility", value: 48 },
      { label: "Capacity Constraint", value: 37 },
    ],
  },
  {
    alertId: "alt-005",
    entity: "Santos Cross-Border Trade Flow",
    riskScore: 68,
    confidence: 79,
    impactedLanes: 7,
    affectedArea: "Cross-border clearance and customs flow",
    etaImpact: "18–48 hours added lead time",
    rootCauses: [
      { label: "Border Friction", value: 77 },
      { label: "Clearance Delay", value: 68 },
      { label: "Policy Uncertainty", value: 52 },
    ],
  },
];

export const supplierRiskData = [
  { supplier: "A", risk: 82, dependency: 74 },
  { supplier: "B", risk: 61, dependency: 68 },
  { supplier: "C", risk: 73, dependency: 59 },
  { supplier: "D", risk: 48, dependency: 52 },
  { supplier: "E", risk: 67, dependency: 81 },
  { supplier: "F", risk: 67, dependency: 81 },
  { supplier: "G", risk: 67, dependency: 81 },
  { supplier: "H", risk: 67, dependency: 81 },
  { supplier: "I", risk: 67, dependency: 81 },
];

export const logisticsTransportData = [
  { day: "Mon", delay: 18, throughput: 72 },
  { day: "Tue", delay: 22, throughput: 69 },
  { day: "Wed", delay: 27, throughput: 65 },
  { day: "Thu", delay: 21, throughput: 71 },
  { day: "Fri", delay: 31, throughput: 60 },
  { day: "Sat", delay: 24, throughput: 66 },
  { day: "Sun", delay: 19, throughput: 73 },
];

export const predictiveRiskData = [
  { week: "W1", current: 42, forecast: 48 },
  { week: "W2", current: 46, forecast: 54 },
  { week: "W3", current: 51, forecast: 61 },
  { week: "W4", current: 49, forecast: 66 },
  { week: "W5", current: 57, forecast: 72 },
  { week: "W6", current: 63, forecast: 79 },
];

export type MitigationScenario = {
  id: string;
  label: string;
  riskScore: number;
  delayHours: number;
  recoveryDays: number;
  costImpact: number;
};

export type ReroutePlan = {
  shipmentIds: string[];
  from: string;
  to: string;
  etaSavingsHours: number;
};

export type StockPlan = {
  supplier: string;
  skuGroup: string;
  currentDaysCover: number;
  recommendedDaysCover: number;
  increasePercent: number;
};

export type MitigationRecommendation = {
  id: string;
  alertId: string;
  title: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  impactReduction: number;
  reason: string;
  actions: string[];
  reroutePlan?: ReroutePlan;
  stockPlan?: StockPlan;
  scenarios: MitigationScenario[];
};

export const mitigationRecommendations: MitigationRecommendation[] = [
  {
    id: "mit-001",
    alertId: "alt-001",
    title: "Reroute high-priority cargo via Long Beach backup lane",
    priority: "high",
    confidence: 87,
    impactReduction: 18,
    reason:
      "Port congestion at Los Angeles is increasing delay risk for westbound containers.",
    actions: [
      "Move urgent shipments to alternate terminal capacity",
      "Protect top-priority customer deliveries",
      "Reduce dwell time on exposed containers",
    ],
    reroutePlan: {
      shipmentIds: ["SHP-1042", "SHP-1057", "SHP-1063"],
      from: "Los Angeles Port",
      to: "Long Beach Terminal 2",
      etaSavingsHours: 10,
    },
    scenarios: [
      { id: "base-001", label: "No Action", riskScore: 82, delayHours: 18, recoveryDays: 4.5, costImpact: 0 },
      { id: "reroute-001", label: "Reroute via Alternate Port", riskScore: 61, delayHours: 8, recoveryDays: 3.2, costImpact: 6 },
      { id: "buffer-001", label: "Reroute + Buffer Stock", riskScore: 54, delayHours: 4, recoveryDays: 2.6, costImpact: 11 },
    ],
  },
  {
    id: "mit-002",
    alertId: "alt-004",
    title: "Increase safety stock for exposed electronics components",
    priority: "medium",
    confidence: 81,
    impactReduction: 12,
    reason:
      "Supplier instability in Singapore may reduce continuity for critical component flow.",
    actions: [
      "Raise inventory cover for vulnerable SKUs",
      "Prioritize high-dependency material groups",
      "Prepare alternate supplier activation",
    ],
    stockPlan: {
      supplier: "Singapore Supplier Network",
      skuGroup: "Power Control Modules",
      currentDaysCover: 5,
      recommendedDaysCover: 8,
      increasePercent: 60,
    },
    scenarios: [
      { id: "base-002", label: "No Action", riskScore: 74, delayHours: 14, recoveryDays: 3.9, costImpact: 0 },
      { id: "stock-002", label: "Increase Safety Stock", riskScore: 63, delayHours: 9, recoveryDays: 3.1, costImpact: 5 },
      { id: "stock-alt-002", label: "Stock + Alternate Supplier", riskScore: 52, delayHours: 5, recoveryDays: 2.4, costImpact: 10 },
    ],
  },
  {
    id: "mit-003",
    alertId: "alt-002",
    title: "Activate alternate carrier for Europe corridor",
    priority: "medium",
    confidence: 74,
    impactReduction: 9,
    reason:
      "Labor unrest around Rotterdam raises carrier execution risk for Europe-bound freight.",
    actions: [
      "Shift overflow bookings to secondary partner",
      "Protect premium customer lanes first",
      "Reduce single-carrier dependency",
    ],
    reroutePlan: {
      shipmentIds: ["SHP-2021", "SHP-2028"],
      from: "Rotterdam Port",
      to: "Antwerp Gateway",
      etaSavingsHours: 6,
    },
    scenarios: [
      { id: "base-003", label: "No Action", riskScore: 69, delayHours: 12, recoveryDays: 3.4, costImpact: 0 },
      { id: "altcar-003", label: "Activate Alternate Carrier", riskScore: 58, delayHours: 7, recoveryDays: 2.8, costImpact: 4 },
      { id: "hybrid-003", label: "Carrier + Priority Allocation", riskScore: 50, delayHours: 4, recoveryDays: 2.2, costImpact: 7 },
    ],
  },
];


