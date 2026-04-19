"use client";

import { useEffect, useMemo, useState } from "react";
import { getMlRoutePrediction, updateAlertStatus, type ApiRoutePrediction } from "@/lib/api";
import type { AlertItem } from "@/lib/mappers";
import type { DashboardStatusValue } from "../lib/types";

export function useDashboardSelection(alerts: AlertItem[]) {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedMlPrediction, setSelectedMlPrediction] =
    useState<ApiRoutePrediction | null>(null);
  const [mlPredictionLoading, setMlPredictionLoading] = useState(false);
  const [mlPredictionError, setMlPredictionError] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Exclude<DashboardStatusValue, "active">>
  >({});

  const alertsWithOverrides = useMemo(
    () =>
      alerts.map((alert) => ({
        ...alert,
        status: statusOverrides[alert.id] ?? alert.status,
      })),
    [alerts, statusOverrides]
  );

  const selectedAlert = useMemo(
    () => alertsWithOverrides.find((alert) => alert.id === selectedAlertId) ?? null,
    [alertsWithOverrides, selectedAlertId]
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadMlPrediction() {
      if (selectedAlert?.entityType === "port") {
        setSelectedMlPrediction(null);
        setMlPredictionError(null);
        setMlPredictionLoading(false);
        return;
      }

      if (
        !selectedAlert?.routeKey &&
        !(selectedAlert?.originPort && selectedAlert?.destinationPort)
      ) {
        setSelectedMlPrediction(null);
        setMlPredictionError(null);
        setMlPredictionLoading(false);
        return;
      }

      try {
        setMlPredictionLoading(true);
        setMlPredictionError(null);

        const prediction = await getMlRoutePrediction({
          routeKey: selectedAlert.routeKey,
          originPort: selectedAlert.originPort,
          destinationPort: selectedAlert.destinationPort,
          weatherScore: selectedAlert.weatherRisk ?? 0,
          newsScore: selectedAlert.newsScore ?? 0,
          congestionScore: selectedAlert.congestionScore ?? 0,
        });

        if (!isCancelled) {
          setSelectedMlPrediction(prediction);
        }
      } catch (err) {
        if (!isCancelled) {
          setSelectedMlPrediction(null);
          setMlPredictionError(
            err instanceof Error ? err.message : "Failed to load ML prediction"
          );
        }
      } finally {
        if (!isCancelled) {
          setMlPredictionLoading(false);
        }
      }
    }

    loadMlPrediction();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedAlert?.entityType,
    selectedAlert?.routeKey,
    selectedAlert?.originPort,
    selectedAlert?.destinationPort,
    selectedAlert?.weatherRisk,
    selectedAlert?.newsScore,
    selectedAlert?.congestionScore,
  ]);

  async function handleStatusChange(
    alertId: string,
    status: Exclude<DashboardStatusValue, "active">
  ) {
    try {
      await updateAlertStatus(alertId, status);

      setStatusOverrides((prev) => ({ ...prev, [alertId]: status }));

      setSelectedAlertId((prev) => {
        if (prev !== alertId) return prev;
        return status === "resolved" ? null : prev;
      });
    } catch (err) {
      console.error("Failed to update alert status:", err);
    }
  }

  return {
    alerts: alertsWithOverrides,
    selectedAlertId,
    setSelectedAlertId,
    selectedAlert,
    selectedMlPrediction,
    mlPredictionLoading,
    mlPredictionError,
    handleStatusChange,
  };
}
