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
  current: number;
  forecast: number;
  drift: number;
};

export type ApiSupplierExposureItem = {
  supplier_id: string;
  supplier_name: string;
  risk_score: number;
  dependency_score: number;
  combined_score: number;
};

export type ApiLanePressureItem = {
  lane: string;
  avg_delay_hours: number;
  throughput_pct: number;
  pressure_score: number;
  shipment_count: number;
};

export type ApiMitigationScenario = {
  id: string;
  label: string;
  risk_score: number;
  delay_hours: number;
  recovery_days: number;
  cost_impact: number;
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
  reroute_plan?: {
    from: string;
    to: string;
    eta_savings_hours: number;
  };
  stock_plan?: {
    supplier: string;
    sku_group: string;
    current_days_cover: number;
    recommended_days_cover: number;
    increase_percent: number;
  };
  scenarios: ApiMitigationScenario[];
};

export type ApiAlert = {
  _id?: string;
  alert_id: string;
  entity_type: "route";
  entity_id: string;
  route_key: string;
  title: string;
  summary: string;
  category: "climate" | "geo" | "logistics";
  level: "stable" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  timestamp: string;
  location: string;
  origin_port?: string;
  destination_port?: string;
  risk_score: number;
  lat?: number;
  lng?: number;
  country?: string;
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

export async function getSupplierExposure() {
  return apiFetch<ApiSupplierExposureItem[]>("/analytics/supplier-exposure");
}

export async function getLanePressure() {
  return apiFetch<ApiLanePressureItem[]>("/analytics/lane-pressure");
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
  }>("/alerts/generate", {
    method: "POST",
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