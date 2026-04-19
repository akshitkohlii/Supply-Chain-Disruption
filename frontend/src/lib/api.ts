const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api/v1";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: string };
      if (data?.detail) message = data.detail;
    } catch {
      //
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type ApiDashboardOverview = {
  globalRiskScore: number;
  criticalAlerts: number;
  highRiskRoutes: number;
  delayedShipmentsPercent: number;
  avgRouteDelayHours: number;
};

export type ApiAlertSummary = {
  total_alerts: number;
  active_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  top_category: string;
};

export type ApiAlertThresholdSettings = {
  critical_risk_threshold: number;
  warning_risk_threshold: number;
  regenerate_alerts?: boolean | null;
  generation_result?: {
    success: boolean;
    routes_evaluated: number;
    alerts_upserted: number;
    skipped: number;
    critical_risk_threshold: number;
    warning_risk_threshold: number;
  } | null;
};

export type ApiMapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  level: "stable" | "warning" | "critical";
  weatherScore: number;
  newsScore: number;
  summary: string;
};

export type ApiSuppliersOverview = {
  total_suppliers: number;
  high_risk_suppliers: number;
  medium_risk_suppliers: number;
  low_risk_suppliers: number;
  avg_risk_score: number;
  suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    supplier_country: string;
    supplier_region: string;
    avg_delay_hours: number;
    avg_inventory_level: number;
    avg_lead_time: number;
    shipment_count: number;
    risk_score: number;
    dependency_score: number;
    risk_band: "low" | "medium" | "high";
  }>;
};

export type ApiAnalyticsOverview = {
  avg_forecast_risk: number;
  forecast_drift: number;
  avg_supplier_risk: number;
  critical_alerts: number;
  avg_delay_hours: number;
};


export type ApiForecastPoint = {
  day: string;
  today_baseline: number;
  forecast_risk: number;
  drift: number;
};

export type ApiAnalyticsTimeSeriesPoint = {
  day: string;
  date: string;
  current_risk: number;
  forecast_risk: number;
  drift: number;
  weather_score: number;
  news_score: number;
  congestion_score: number;
  logistics_score: number;
  emerging_score: number;
  route_count: number;
};

export type ApiSupplierExposureItem = {
  supplier_id: string;
  supplier_name: string;
  supplier_country: string;
  supplier_region: string;
  risk_score: number;
  dependency_score: number;
};

export type ApiLanePressureItem = {
  lane: string;
  origin_port: string;
  destination_port: string;
  pressure_score: number;
  delay_hours: number;
  throughput_pct: number;
  shipment_count: number;
};

export type ApiLogisticsOverview = {
  total_shipments: number;
  avg_delay_hours: number;
  avg_expected_time_hours: number;
  avg_actual_time_hours: number;
  avg_throughput_pct: number;
  peak_delay_day: {
    day: string;
    avg_delay_hours: number;
  } | null;
  delay_distribution: {
    low: number;
    medium: number;
    high: number;
  };
};

export type ApiLogisticsTimeSeriesPoint = {
  day: string;
  avg_delay_hours: number;
  throughput_pct: number;
};

export type ApiMitigationScenario = {
  id: string;
  label: string;
  risk_score: number;
  delay_hours: number;
  recovery_days: number;
  cost_impact: number;
};
export type ApiReroutePlan = {
  from: string;
  to: string;
  eta_savings_hours: number;
};

export type ApiStockPlan = {
  supplier: string;
  sku_group: string;
  current_days_cover: number;
  recommended_days_cover: number;
  increase_percent: number;
};

export type ApiMitigationPlan = {
  id: string;
  alert_id: string;
  title: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  impact_reduction: number;
  reason: string;
  actions: string[];
  reroute_plan?: ApiReroutePlan;
  stock_plan?: ApiStockPlan;
  scenarios: ApiMitigationScenario[];
};

export type ApiAlert = {
  _id?: string;
  alert_id: string;
  entity_type: "route" | "port";
  entity_id?: string;
  route_key?: string | null;
  title: string;
  summary: string;
  category: "supplier" | "port" | "climate" | "geo" | "logistics";
  level: "stable" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  timestamp: string;
  location: string;
  origin_port?: string;
  destination_port?: string;
  related_origin_port?: string;
  related_destination_port?: string;
  shipment_id?: string;
  risk_score: number;
  lat?: number;
  lng?: number;
  country?: string;
  weather_score?: number;
  news_score?: number;
  logistics_score?: number;
  congestion_score?: number;
  emerging_score?: number;
  final_risk?: number;
  scores?: {
    weather: number;
    news: number;
    logistics: number;
    congestion: number;
    emerging?: number;
    final_risk: number;
    ml?: number;
  };
  ml_prediction?: {
    disruption_probability: number;
    ml_risk_score: number;
    predicted_delay_hours?: number;
    top_factors?: string[];
  };
  emerging_impact?: {
    score: number;
    top_ports?: string[];
    signals?: Array<{
      signal_id: string;
      source_type: "news" | "weather" | "congestion";
      risk_type?: string;
      severity: "low" | "medium" | "high";
      port_name?: string;
      emerging_score?: number;
      impact_score: number;
      title?: string;
    }>;
  };
  top_drivers?: string[];
  updated_at?: string;
};

export type ApiRoutePrediction = {
  route_key: string;
  disruption_probability: number;
  predicted_label: "stable" | "warning" | "critical";
  ml_risk_score: number;
  predicted_delay_hours: number;
  top_factors: string[];
};

export async function getDashboardOverview() {
  return apiFetch<ApiDashboardOverview>("/dashboard/overview");
}

export async function getAlertSummary() {
  return apiFetch<ApiAlertSummary>("/alerts/summary");
}

export async function getMapPoints(limit = 500) {
  return apiFetch<ApiMapPoint[]>(`/map/points?limit=${limit}`);
}

export async function getSuppliersOverview() {
  return apiFetch<ApiSuppliersOverview>("/suppliers/overview");
}

export async function getAnalyticsOverview() {
  return apiFetch<ApiAnalyticsOverview>("/analytics/overview");
}

export async function getAnalyticsForecast() {
  return apiFetch<ApiForecastPoint[]>("/analytics/forecast");
}

export async function getAnalyticsTimeSeries(params?: {
  port?: string;
  lane?: string;
}) {
  const search = new URLSearchParams();
  if (params?.port) search.set("port", params.port);
  if (params?.lane) search.set("lane", params.lane);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ApiAnalyticsTimeSeriesPoint[]>(`/analytics/time-series${suffix}`);
}

export async function getSupplierExposure() {
  return apiFetch<ApiSupplierExposureItem[]>("/analytics/supplier-exposure");
}

export async function getLanePressure() {
  return apiFetch<ApiLanePressureItem[]>("/analytics/lane-pressure");
}

export async function getLogisticsOverview() {
  return apiFetch<ApiLogisticsOverview>("/logistics/overview");
}

export async function getLogisticsTimeseries() {
  return apiFetch<ApiLogisticsTimeSeriesPoint[]>("/logistics/timeseries");
}

export async function getMitigationPlan(alertId: string) {
  return apiFetch<ApiMitigationPlan>(`/mitigation/${encodeURIComponent(alertId)}`);
}

export async function updateAlertStatus(
  alertId: string,
  status: "active" | "acknowledged" | "resolved"
) {
  return apiFetch<{ message: string; alert_id: string; status: string }>(
    `/alerts/${encodeURIComponent(alertId)}/status?status=${encodeURIComponent(status)}`,
    {
      method: "PATCH",
    }
  );
}

export async function getAlerts(limit = 50) {
  return apiFetch<ApiAlert[]>(`/alerts?limit=${limit}`);
}

export async function generateAlerts() {
  return apiFetch<{
    success: boolean;
    routes_evaluated: number;
    alerts_upserted: number;
    skipped: number;
    critical_risk_threshold: number;
    warning_risk_threshold: number;
  }>("/alerts/generate", {
    method: "POST",
  });
}

export async function updateAlertThresholdSettings(params: {
  criticalRiskThreshold: number;
  warningRiskThreshold: number;
  regenerateAlerts?: boolean;
}) {
  return apiFetch<ApiAlertThresholdSettings>("/alerts/settings", {
    method: "PUT",
    body: JSON.stringify({
      critical_risk_threshold: params.criticalRiskThreshold,
      warning_risk_threshold: params.warningRiskThreshold,
      regenerate_alerts: params.regenerateAlerts ?? true,
    }),
  });
}

export async function getMlRoutePrediction(params: {
  routeKey?: string;
  originPort?: string;
  destinationPort?: string;
  weatherScore?: number;
  newsScore?: number;
  congestionScore?: number;
}) {
  const search = new URLSearchParams();

  if (params.routeKey) search.set("route_key", params.routeKey);
  if (params.originPort) search.set("origin_port", params.originPort);
  if (params.destinationPort) search.set("destination_port", params.destinationPort);

  search.set("weather_score", String(params.weatherScore ?? 0));
  search.set("news_score", String(params.newsScore ?? 0));
  search.set("congestion_score", String(params.congestionScore ?? 0));

  return apiFetch<ApiRoutePrediction>(`/ml/predict-route?${search.toString()}`);
}

export type ApiEmergingSignal = {
  _id?: string;
  signal_id: string;
  source_signal_id?: string;
  source_type: "news" | "weather" | "congestion";
  title: string;
  summary: string;
  port_name?: string;
  country?: string;
  lat?: number;
  lng?: number;
  is_relevant: boolean;
  relevance_probability: number;
  emerging_score: number;
  risk_type: "weather" | "geo" | "logistics" | "congestion" | "mixed";
  severity: "low" | "medium" | "high";
  created_at?: string;
  updated_at?: string;
};

export async function getEmergingSignals(params?: {
  limit?: number;
  relevantOnly?: boolean;
  sourceType?: "news" | "weather" | "congestion";
}) {
  const search = new URLSearchParams();

  search.set("limit", String(params?.limit ?? 6));
  search.set("relevant_only", String(params?.relevantOnly ?? true));

  if (params?.sourceType) {
    search.set("source_type", params.sourceType);
  }

  return apiFetch<ApiEmergingSignal[]>(`/emerging-signals?${search.toString()}`);
}

export type ApiSupplierPrediction = {
  supplier_id: string;
  supplier_name: string;
  disruption_probability: number;
  predicted_label: "stable" | "warning" | "critical";
  supplier_risk_score: number;
  predicted_delay_hours: number;
  top_factors: string[];
  features: {
    supplier_id: string;
    supplier_name: string;
    supplier_country: string;
    supplier_region: string;
    business_unit: string;
    shipment_count: number;
    avg_delay_hours: number;
    avg_customs_clearance_hours: number;
    avg_inventory_level: number;
    avg_safety_stock_level: number;
    inventory_gap: number;
    inventory_ratio: number;
    avg_demand_volatility: number;
    avg_order_value: number;
    avg_route_risk: number;
    avg_route_ml_risk: number;
    route_warning_share: number;
    route_critical_share: number;
  };
};

export async function getSupplierMlPrediction(supplierId: string) {
  return apiFetch<ApiSupplierPrediction>(
    `/supplier-ml/predict/${encodeURIComponent(supplierId)}`
  );
}

export type ApiSupplierListItem = {
  supplier_id: string;
  supplier_name: string;
  supplier_country: string;
  supplier_region: string;
  avg_delay_hours: number;
  avg_inventory_level: number;
  avg_lead_time: number;
  shipment_count: number;
  risk_score: number;
  dependency_score: number;
  risk_band: "low" | "medium" | "high";
};

export async function getAllSuppliers() {
  return apiFetch<ApiSupplierListItem[]>("/suppliers");
}
