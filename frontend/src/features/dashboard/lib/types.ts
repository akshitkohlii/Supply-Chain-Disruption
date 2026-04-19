import type {
  ApiAlertSummary,
  ApiAnalyticsOverview,
  ApiDashboardOverview,
  ApiEmergingSignal,
  ApiForecastPoint,
  ApiLanePressureItem,
  ApiRoutePrediction,
  ApiSupplierExposureItem,
} from "@/lib/api";
import type { AlertItem, KpiItem } from "@/lib/mappers";

export type LayerFilter =
  | "all"
  | "supplier"
  | "port"
  | "climate"
  | "geo"
  | "logistics";

export type LevelFilter = "all" | "stable" | "warning" | "critical";

export type ScopeFilter = "Global" | "Regional";

export type TimeFilter = "Last 24 Hours" | "Last 7 Days" | "Last 30 Days";

export type StatusFilter = "All" | "Alerts" | "Acknowledged" | "Resolved";

export type DashboardStatusValue = "active" | "acknowledged" | "resolved";

export type RiskLevelFilter = "All Levels" | "Stable" | "Warning" | "Critical";

export type DashboardFiltersState = {
  searchInput: string;
  debouncedSearch: string;
  region: string;
  userRegion: string;
  businessUnit: string;
  riskLevel: RiskLevelFilter;
  activeLayer: LayerFilter;
  activeLevel: LevelFilter;
  scope: ScopeFilter;
  timeRange: TimeFilter;
  status: StatusFilter;
};

export type DashboardDataState = {
  dashboardOverview: ApiDashboardOverview | null;
  alertSummary: ApiAlertSummary | null;
  alerts: AlertItem[];

  analyticsOverview: ApiAnalyticsOverview | null;
  forecastData: ApiForecastPoint[];
  supplierExposureData: ApiSupplierExposureItem[];
  lanePressureData: ApiLanePressureItem[];

  emergingSignals: ApiEmergingSignal[];

  isLoading: boolean;
  error: string | null;

  midLoading: boolean;
  midError: string | null;

  emergingSignalsLoading: boolean;
  emergingSignalsError: string | null;
};

export type DashboardSelectionState = {
  selectedAlertId: string | null;
  selectedAlert: AlertItem | null;
  selectedMlPrediction: ApiRoutePrediction | null;
  mlPredictionLoading: boolean;
  mlPredictionError: string | null;
};

export type DashboardViewModel = {
  kpis: KpiItem[];
  notificationAlerts: AlertItem[];
  filteredAlerts: AlertItem[];
  visibleAlerts: AlertItem[];
  mapVisibleAlerts: AlertItem[];
  selectedAlert: AlertItem | null;
  isRailOpen: boolean;
};
