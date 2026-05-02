"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";

import Topbar from "@/components/dashboard/Topbar";
import SearchFilters from "@/components/dashboard/SearchFilters";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MainMapSection from "@/components/dashboard/MainMapSection";
import RightRail from "@/components/dashboard/RightRail";

import { buildDashboardKpisFromApi } from "@/lib/mappers";
import { applyAlertThresholds } from "@/lib/mappers";
import { REGION_OPTIONS } from "@/lib/settings";
import { useAppSettings } from "@/features/dashboard/hooks/useAppSettings";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { useDashboardFilters } from "@/features/dashboard/hooks/useDashboardFilters";
import { useDashboardSelection } from "@/features/dashboard/hooks/useDashboardSelection";
import {
  buildMapVisibleAlerts,
  buildNotificationAlerts,
  buildVisibleAlerts,
  filterAlerts,
} from "@/features/dashboard/lib/selectors";

const MidCardsSection = dynamic(
  () => import("@/components/dashboard/MidCardsSection"),
  {
    loading: () => (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-sm text-slate-400">
        Loading analytics panels...
      </div>
    ),
  }
);

const BottomSection = dynamic(
  () => import("@/components/dashboard/BottomSection"),
  {
    loading: () => (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-sm text-slate-400">
        Loading mitigation panels...
      </div>
    ),
  }
);

function DashboardLoadingState() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.84))] px-10 py-12 text-center shadow-[0_24px_80px_rgba(2,132,199,0.14)]"
      >
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
        <div className="flex flex-col items-center gap-5">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="relative h-14 w-14"
          >
            <div className="absolute inset-0 rounded-full border-2 border-slate-700/80" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-400/70 shadow-[0_0_22px_rgba(34,211,238,0.35)]" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-[0.02em] text-white md:text-xl">
              Loading dashboard
            </h2>
            <p className="max-w-sm text-sm leading-6 text-slate-300">
              Pulling alerts, analytics, and logistics signals into view.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function DashboardPage() {
  const data = useDashboardData();
  const settings = useAppSettings();
  const {
    filters,
    searchInput,
    setSearchInput,
    region,
    setRegion,
    businessUnit,
    setBusinessUnit,
    riskLevel,
    handleRiskLevelChange,
    activeLayer,
    setActiveLayer,
    activeLevel,
    setActiveLevel,
    scope,
    setScope,
    timeRange,
    setTimeRange,
    status,
    setStatus,
  } = useDashboardFilters();

  const thresholdedAlerts = useMemo(
    () => data.alerts.map((alert) => applyAlertThresholds(alert, settings)),
    [data.alerts, settings]
  );

  const {
    alerts,
    selectedAlertId,
    setSelectedAlertId,
    selectedAlert,
    selectedMlPrediction,
    mlPredictionLoading,
    mlPredictionError,
    handleStatusChange,
  } = useDashboardSelection(thresholdedAlerts);

  const filteredAlerts = useMemo(() => filterAlerts(alerts, filters), [alerts, filters]);

  const regionOptions = useMemo(() => {
    const values = new Set<string>();
    for (const alert of alerts) {
      if (alert.region && alert.region !== "Global") {
        values.add(alert.region);
      }
    }
    for (const regionOption of REGION_OPTIONS) {
      if (regionOption !== "All Regions") {
        values.add(regionOption);
      }
    }
    return ["All Regions", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [alerts]);

  const businessUnitOptions = useMemo(() => {
    return [
      "All Units",
      ...((data.dashboardFilterOptions?.business_units ?? []).slice().sort((a, b) =>
        a.localeCompare(b)
      )),
    ];
  }, [data.dashboardFilterOptions]);

  const visibleAlerts = useMemo(
    () => buildVisibleAlerts(filteredAlerts, settings),
    [filteredAlerts, settings]
  );

  const mapVisibleAlerts = useMemo(
    () => buildMapVisibleAlerts(visibleAlerts, selectedAlert),
    [visibleAlerts, selectedAlert]
  );

  const notificationAlerts = useMemo(
    () => buildNotificationAlerts(alerts, settings),
    [alerts, settings]
  );

  const kpis = useMemo(
    () =>
      buildDashboardKpisFromApi({
        dashboardOverview: data.dashboardOverview,
        alertSummary: data.alertSummary,
      }),
    [data.dashboardOverview, data.alertSummary]
  );

  const isRailOpen = !!selectedAlert;
  const hasDashboardData =
    !!data.dashboardOverview ||
    !!data.alertSummary ||
    alerts.length > 0 ||
    !!data.dashboardFilterOptions;

  if (data.isLoading && !hasDashboardData) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <div className="relative z-50 shrink-0 border-b border-slate-800/80">
          <Topbar
            scope={scope}
            onScopeChange={setScope}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            status={status}
            onStatusChange={setStatus}
            notifications={notificationAlerts}
            onSelectNotification={(alert) => setSelectedAlertId(alert.id)}
          />
        </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <DashboardLoadingState />
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <div className="relative z-50 shrink-0 border-b border-slate-800/80">
          <Topbar
            scope={scope}
            onScopeChange={setScope}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            status={status}
            onStatusChange={setStatus}
            notifications={notificationAlerts}
            onSelectNotification={(alert) => setSelectedAlertId(alert.id)}
          />
        </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="text-rose-400">{data.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="relative z-50 shrink-0 border-b border-slate-800/80">
        <Topbar
          scope={scope}
          onScopeChange={setScope}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          status={status}
          onStatusChange={setStatus}
          notifications={notificationAlerts}
          onSelectNotification={(alert) => setSelectedAlertId(alert.id)}
        />
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <section className="space-y-6">
          <SearchFilters
            search={searchInput}
            onSearchChange={setSearchInput}
            region={region}
            onRegionChange={setRegion}
            businessUnit={businessUnit}
            onBusinessUnitChange={setBusinessUnit}
            regionOptions={regionOptions}
            businessUnitOptions={businessUnitOptions}
            riskLevel={riskLevel}
            onRiskLevelChange={handleRiskLevelChange}
          />

          <KpiGrid kpis={kpis} />

          <div className="hidden items-start gap-6 xl:flex">
            <motion.div
              layout
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-1"
            >
              <MainMapSection
                mapAlerts={mapVisibleAlerts}
                feedAlerts={visibleAlerts}
                selectedAlert={selectedAlert}
                onSelectAlert={(alert) => setSelectedAlertId(alert?.id ?? null)}
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
                activeLevel={activeLevel}
                onLevelChange={setActiveLevel}
                onAcknowledge={(id) => handleStatusChange(id, "acknowledged")}
                onResolve={(id) => handleStatusChange(id, "resolved")}
                emergingSignals={data.emergingSignals}
                emergingSignalsLoading={data.emergingSignalsLoading}
                emergingSignalsError={data.emergingSignalsError}
              />
            </motion.div>

            <AnimatePresence initial={false} mode="popLayout">
              {isRailOpen && (
                <motion.div
                  key="right-rail"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0 shrink-0 overflow-hidden"
                >
                  <RightRail
                    selectedAlert={selectedAlert}
                    isOpen={isRailOpen}
                    onClose={() => setSelectedAlertId(null)}
                    mlPrediction={selectedMlPrediction}
                    mlPredictionLoading={mlPredictionLoading}
                    mlPredictionError={mlPredictionError}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="xl:hidden">
            <MainMapSection
              mapAlerts={mapVisibleAlerts}
              feedAlerts={visibleAlerts}
              selectedAlert={selectedAlert}
              onSelectAlert={(alert) => setSelectedAlertId(alert?.id ?? null)}
              activeLayer={activeLayer}
              onLayerChange={setActiveLayer}
              activeLevel={activeLevel}
              onLevelChange={setActiveLevel}
              onAcknowledge={(id) => handleStatusChange(id, "acknowledged")}
              onResolve={(id) => handleStatusChange(id, "resolved")}
              emergingSignals={data.emergingSignals}
              emergingSignalsLoading={data.emergingSignalsLoading}
              emergingSignalsError={data.emergingSignalsError}
            />
          </div>

          {data.midError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
              {data.midError}
            </div>
          ) : (
            <MidCardsSection
              supplierExposureData={data.supplierExposureData}
              lanePressureData={data.lanePressureData}
              forecastData={data.forecastData}
              analyticsOverview={data.analyticsOverview}
              isLoading={data.midLoading}
            />
          )}

          <BottomSection selectedAlertId={selectedAlertId} />
        </section>
      </div>
    </div>
  );
}
