"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAlertSummary,
  getAlerts,
  getAnalyticsForecast,
  getAnalyticsOverview,
  getDashboardOverview,
  getEmergingSignals,
  getLanePressure,
  getSupplierExposure,
} from "@/lib/api";
import { mapApiAlertToUiAlert, type AlertItem } from "@/lib/mappers";
import type { DashboardDataState } from "../lib/types";

const DASHBOARD_REFRESH_MS =
  Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS ?? "60000") || 60000;

export function useDashboardData(): DashboardDataState {
  const [dashboardOverview, setDashboardOverview] =
    useState<DashboardDataState["dashboardOverview"]>(null);
  const [alertSummary, setAlertSummary] =
    useState<DashboardDataState["alertSummary"]>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [analyticsOverview, setAnalyticsOverview] =
    useState<DashboardDataState["analyticsOverview"]>(null);
  const [forecastData, setForecastData] =
    useState<DashboardDataState["forecastData"]>([]);
  const [supplierExposureData, setSupplierExposureData] =
    useState<DashboardDataState["supplierExposureData"]>([]);
  const [lanePressureData, setLanePressureData] =
    useState<DashboardDataState["lanePressureData"]>([]);

  const [emergingSignals, setEmergingSignals] =
    useState<DashboardDataState["emergingSignals"]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [midLoading, setMidLoading] = useState(true);
  const [midError, setMidError] = useState<string | null>(null);

  const [emergingSignalsLoading, setEmergingSignalsLoading] = useState(true);
  const [emergingSignalsError, setEmergingSignalsError] = useState<string | null>(null);
  const hasLoadedDashboardRef = useRef(false);
  const hasLoadedMidCardsRef = useRef(false);
  const hasLoadedEmergingSignalsRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;
    let dashboardTimer: ReturnType<typeof setTimeout> | null = null;
    let midCardsTimer: ReturnType<typeof setTimeout> | null = null;
    let emergingSignalsTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadDashboard() {
      try {
        if (!hasLoadedDashboardRef.current) {
          setIsLoading(true);
        }
        setError(null);

        const [overview, summary, alertsResponse] = await Promise.all([
          getDashboardOverview(),
          getAlertSummary(),
          getAlerts(100),
        ]);

        if (isCancelled) return;

        setDashboardOverview(overview);
        setAlertSummary(summary);
        setAlerts(alertsResponse.map(mapApiAlertToUiAlert));
        hasLoadedDashboardRef.current = true;
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          dashboardTimer = setTimeout(loadDashboard, DASHBOARD_REFRESH_MS);
        }
      }
    }

    async function loadMidCards() {
      try {
        if (!hasLoadedMidCardsRef.current) {
          setMidLoading(true);
        }
        setMidError(null);

        const [overview, forecast, supplierExposure, lanePressure] =
          await Promise.all([
            getAnalyticsOverview(),
            getAnalyticsForecast(),
            getSupplierExposure(),
            getLanePressure(),
          ]);

        if (isCancelled) return;

        setAnalyticsOverview(overview);
        setForecastData(forecast);
        setSupplierExposureData(supplierExposure);
        setLanePressureData(lanePressure);
        hasLoadedMidCardsRef.current = true;
      } catch (err) {
        if (isCancelled) return;
        setMidError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        if (!isCancelled) {
          setMidLoading(false);
          midCardsTimer = setTimeout(loadMidCards, DASHBOARD_REFRESH_MS);
        }
      }
    }

    async function loadEmergingSignals() {
      try {
        if (!hasLoadedEmergingSignalsRef.current) {
          setEmergingSignalsLoading(true);
        }
        setEmergingSignalsError(null);

        const result = await getEmergingSignals({ limit: 12 });

        if (isCancelled) return;
        setEmergingSignals(result);
        hasLoadedEmergingSignalsRef.current = true;
      } catch (err) {
        if (isCancelled) return;
        setEmergingSignalsError(
          err instanceof Error ? err.message : "Failed to load emerging signals."
        );
      } finally {
        if (!isCancelled) {
          setEmergingSignalsLoading(false);
          emergingSignalsTimer = setTimeout(loadEmergingSignals, DASHBOARD_REFRESH_MS);
        }
      }
    }

    loadDashboard();
    loadMidCards();
    loadEmergingSignals();

    return () => {
      isCancelled = true;
      if (dashboardTimer) clearTimeout(dashboardTimer);
      if (midCardsTimer) clearTimeout(midCardsTimer);
      if (emergingSignalsTimer) clearTimeout(emergingSignalsTimer);
    };
  }, []);

  return {
    dashboardOverview,
    alertSummary,
    alerts,
    analyticsOverview,
    forecastData,
    supplierExposureData,
    lanePressureData,
    emergingSignals,
    isLoading,
    error,
    midLoading,
    midError,
    emergingSignalsLoading,
    emergingSignalsError,
  };
}
