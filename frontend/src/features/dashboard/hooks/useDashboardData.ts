"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getCachedApiData,
  getAlertSummary,
  getAlerts,
  getAnalyticsForecast,
  getAnalyticsOverview,
  getDashboardFilterOptions,
  getDashboardOverview,
  getEmergingSignals,
  getLanePressure,
  getSupplierExposure,
} from "@/lib/api";
import { mapApiAlertToUiAlert } from "@/lib/mappers";
import type { DashboardDataState } from "../lib/types";

const DASHBOARD_REFRESH_MS =
  Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS ?? "60000") || 60000;

const cachedDashboardOverview = getCachedApiData<DashboardDataState["dashboardOverview"]>(
  "/dashboard/overview"
);
const cachedDashboardFilterOptions = getCachedApiData<
  DashboardDataState["dashboardFilterOptions"]
>("/dashboard/filter-options");
const cachedAlertSummary = getCachedApiData<DashboardDataState["alertSummary"]>(
  "/alerts/summary"
);
const cachedAlerts = getCachedApiData<Parameters<typeof mapApiAlertToUiAlert>[0][]>(
  "/alerts?limit=100"
);
const cachedAnalyticsOverview =
  getCachedApiData<DashboardDataState["analyticsOverview"]>("/analytics/overview");
const cachedForecastData =
  getCachedApiData<DashboardDataState["forecastData"]>("/analytics/forecast");
const cachedSupplierExposureData = getCachedApiData<
  DashboardDataState["supplierExposureData"]
>("/analytics/supplier-exposure");
const cachedLanePressureData = getCachedApiData<DashboardDataState["lanePressureData"]>(
  "/analytics/lane-pressure"
);
const cachedEmergingSignals = getCachedApiData<DashboardDataState["emergingSignals"]>(
  "/emerging-signals?limit=12&relevant_only=true"
);

const INITIAL_STATE: DashboardDataState = {
  dashboardOverview: cachedDashboardOverview ?? null,
  dashboardFilterOptions: cachedDashboardFilterOptions ?? null,
  alertSummary: cachedAlertSummary ?? null,
  alerts: cachedAlerts?.map(mapApiAlertToUiAlert) ?? [],
  analyticsOverview: cachedAnalyticsOverview ?? null,
  forecastData: cachedForecastData ?? [],
  supplierExposureData: cachedSupplierExposureData ?? [],
  lanePressureData: cachedLanePressureData ?? [],
  emergingSignals: cachedEmergingSignals ?? [],
  isLoading:
    !cachedDashboardOverview &&
    !cachedDashboardFilterOptions &&
    !cachedAlertSummary &&
    !cachedAlerts?.length,
  error: null,
  midLoading:
    !cachedAnalyticsOverview &&
    !cachedForecastData?.length &&
    !cachedSupplierExposureData?.length &&
    !cachedLanePressureData?.length,
  midError: null,
  emergingSignalsLoading: !cachedEmergingSignals?.length,
  emergingSignalsError: null,
};

let dashboardState: DashboardDataState = INITIAL_STATE;
const listeners = new Set<() => void>();

let pollingStarted = false;
let hasLoadedDashboard = false;
let hasLoadedMidCards = false;
let hasLoadedEmergingSignals = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateDashboardState(
  partial:
    | Partial<DashboardDataState>
    | ((current: DashboardDataState) => Partial<DashboardDataState>)
) {
  const nextPartial =
    typeof partial === "function" ? partial(dashboardState) : partial;
  dashboardState = {
    ...dashboardState,
    ...nextPartial,
  };
  emitChange();
}

async function loadDashboard() {
  try {
    if (!hasLoadedDashboard) {
      updateDashboardState({ isLoading: true });
    }
    updateDashboardState({ error: null });

    const [overview, filterOptions, summary, alertsResponse] = await Promise.all([
      getDashboardOverview(),
      getDashboardFilterOptions(),
      getAlertSummary(),
      getAlerts(100),
    ]);

    updateDashboardState({
      dashboardOverview: overview,
      dashboardFilterOptions: filterOptions,
      alertSummary: summary,
      alerts: alertsResponse.map(mapApiAlertToUiAlert),
    });
    hasLoadedDashboard = true;
  } catch (err) {
    updateDashboardState({
      error: err instanceof Error ? err.message : "Failed to load dashboard.",
    });
  } finally {
    updateDashboardState({ isLoading: false });
    window.setTimeout(loadDashboard, DASHBOARD_REFRESH_MS);
  }
}

async function loadMidCards() {
  try {
    if (!hasLoadedMidCards) {
      updateDashboardState({ midLoading: true });
    }
    updateDashboardState({ midError: null });

    const [overview, forecast, supplierExposure, lanePressure] = await Promise.all([
      getAnalyticsOverview(),
      getAnalyticsForecast(),
      getSupplierExposure(),
      getLanePressure(),
    ]);

    updateDashboardState({
      analyticsOverview: overview,
      forecastData: forecast,
      supplierExposureData: supplierExposure,
      lanePressureData: lanePressure,
    });
    hasLoadedMidCards = true;
  } catch (err) {
    updateDashboardState({
      midError: err instanceof Error ? err.message : "Failed to load analytics.",
    });
  } finally {
    updateDashboardState({ midLoading: false });
    window.setTimeout(loadMidCards, DASHBOARD_REFRESH_MS);
  }
}

async function loadEmergingSignals() {
  try {
    if (!hasLoadedEmergingSignals) {
      updateDashboardState({ emergingSignalsLoading: true });
    }
    updateDashboardState({ emergingSignalsError: null });

    const result = await getEmergingSignals({ limit: 12 });

    updateDashboardState({ emergingSignals: result });
    hasLoadedEmergingSignals = true;
  } catch (err) {
    updateDashboardState({
      emergingSignalsError:
        err instanceof Error ? err.message : "Failed to load emerging signals.",
    });
  } finally {
    updateDashboardState({ emergingSignalsLoading: false });
    window.setTimeout(loadEmergingSignals, DASHBOARD_REFRESH_MS);
  }
}

function ensurePollingStarted() {
  if (pollingStarted || typeof window === "undefined") {
    return;
  }

  pollingStarted = true;
  void loadDashboard();
  void loadMidCards();
  void loadEmergingSignals();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return dashboardState;
}

export function useDashboardData(): DashboardDataState {
  useEffect(() => {
    ensurePollingStarted();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
