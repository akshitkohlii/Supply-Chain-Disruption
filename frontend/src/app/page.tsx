"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Topbar from "@/components/dashboard/Topbar";
import SearchFilters from "@/components/dashboard/SearchFilters";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MainMapSection from "@/components/dashboard/MainMapSection";
import MidCardsSection from "@/components/dashboard/MidCardsSection";
import BottomSection from "@/components/dashboard/BottomSection";
import RightRail from "@/components/dashboard/RightRail";

import {
  getAlertSummary,
  getAnalyticsForecast,
  getAnalyticsOverview,
  getDashboardOverview,
  getLanePressure,
  getMapPoints,
  getSupplierExposure,
  getSuppliersOverview,
  updateAlertStatus,
  type ApiAnalyticsOverview,
  type ApiForecastPoint,
  type ApiLanePressureItem,
  type ApiSupplierExposureItem,
} from "@/lib/api";

import {
  buildDashboardKpisFromApi,
  mapApiMapPointToUiAlert,
  type AlertItem,
} from "@/lib/mappers";

type LayerFilter = "all" | "supplier" | "port" | "climate" | "geo" | "logistics";
type LevelFilter = "all" | "stable" | "warning" | "critical";
type ScopeFilter = "Global" | "Regional";
type TimeFilter = "Last 24 Hours" | "Last 7 Days" | "Last 30 Days";
type StatusFilter = "All" | "Alerts" | "Acknowledged" | "Resolved";

function levelRank(level: AlertItem["level"]) {
  if (level === "critical") return 3;
  if (level === "warning") return 2;
  return 1;
}

function scoreAlert(alert: AlertItem) {
  const weather = alert.weatherRisk ?? 0;
  const congestion = alert.portCongestion ?? 0;
  const delay = alert.delayHours ?? 0;

  return (
    levelRank(alert.level) * 1000 +
    delay * 10 +
    weather * 100 +
    congestion * 100
  );
}

function dedupeHighestRiskPerLocation(alerts: AlertItem[]) {
  const byLocation = new Map<string, AlertItem>();

  for (const alert of alerts) {
    if (!alert.isMapBacked) continue;

    const key = `${alert.location}|${alert.country}`;
    const existing = byLocation.get(key);

    if (!existing || scoreAlert(alert) > scoreAlert(existing)) {
      byLocation.set(key, alert);
    }
  }

  return Array.from(byLocation.values());
}

function matchesRegionFilter(alert: AlertItem, selectedRegion: string) {
  if (selectedRegion === "All Regions") return true;

  const regionValue = (alert.region ?? "").toLowerCase();
  const countryValue = alert.country.toLowerCase();
  const selected = selectedRegion.toLowerCase();

  return regionValue === selected || countryValue === selected;
}

function matchesBusinessUnitFilter(alert: AlertItem, selectedUnit: string) {
  if (selectedUnit === "All Units") return true;
  return (alert.businessUnit ?? "").toLowerCase() === selectedUnit.toLowerCase();
}

function matchesRiskLevelFilter(alert: AlertItem, selectedRisk: string) {
  if (selectedRisk === "All Levels") return true;
  return alert.level === selectedRisk.toLowerCase();
}

function matchesStatusFilter(alert: AlertItem, selectedStatus: StatusFilter) {
  if (selectedStatus === "All") return true;
  if (selectedStatus === "Alerts") return alert.status === "active";
  if (selectedStatus === "Acknowledged") return alert.status === "acknowledged";
  return alert.status === "resolved";
}

function matchesScopeFilter(alert: AlertItem, selectedScope: ScopeFilter) {
  if (selectedScope === "Global") return true;
  return ["asia", "europe", "north america", "south america"].includes(
    (alert.region ?? "").toLowerCase()
  );
}

function matchesSearchFilter(alert: AlertItem, q: string) {
  if (!q) return true;

  return [
    alert.title,
    alert.location,
    alert.country,
    alert.region ?? "",
    alert.businessUnit ?? "",
    alert.category,
    alert.summary,
    alert.status,
    alert.supplierName ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const [activeLayer, setActiveLayer] = useState<LayerFilter>("all");
  const [activeLevel, setActiveLevel] = useState<LevelFilter>("all");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [region, setRegion] = useState("All Regions");
  const [businessUnit, setBusinessUnit] = useState("All Units");
  const [riskLevel, setRiskLevel] = useState("All Levels");

  const [scope, setScope] = useState<ScopeFilter>("Global");
  const [timeRange, setTimeRange] = useState<TimeFilter>("Last 7 Days");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [midIsLoading, setMidIsLoading] = useState(true);
  const [forecastData, setForecastData] = useState<ApiForecastPoint[]>([]);
  const [supplierExposureData, setSupplierExposureData] = useState<ApiSupplierExposureItem[]>([]);
  const [lanePressureData, setLanePressureData] = useState<ApiLanePressureItem[]>([]);
  const [analyticsOverview, setAnalyticsOverview] = useState<ApiAnalyticsOverview | null>(null);

  const [kpis, setKpis] = useState<
    {
      title: string;
      value: string;
      change: string;
      trend: "up" | "down" | "neutral";
      risk: "low" | "medium" | "high";
    }[]
  >([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        setMidIsLoading(true);
        setError(null);

        const [
          dashboardOverview,
          alertSummary,
          mapPointsRes,
          suppliersOverview,
          analyticsOverviewRes,
          forecastRes,
          supplierExposureRes,
          lanePressureRes,
        ] = await Promise.all([
          getDashboardOverview(),
          getAlertSummary(),
          getMapPoints(50),
          getSuppliersOverview(),
          getAnalyticsOverview(),
          getAnalyticsForecast(),
          getSupplierExposure(),
          getLanePressure(),
        ]);

        const uiAlerts = mapPointsRes.map(mapApiMapPointToUiAlert);

        setAlerts(uiAlerts);

        setKpis(
          buildDashboardKpisFromApi({
            dashboardOverview,
            alertSummary,
            suppliersOverview,
          })
        );

        setAnalyticsOverview(analyticsOverviewRes);
        setForecastData(forecastRes);
        setSupplierExposureData(supplierExposureRes);
        setLanePressureData(lanePressureRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
        setMidIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const normalizedSearch = useMemo(() => {
    return search.trim().toLowerCase();
  }, [search]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch = matchesSearchFilter(alert, normalizedSearch);
      const matchesLayer =
        activeLayer === "all" ? true : alert.category === activeLayer;
      const matchesLegendLevel =
        activeLevel === "all" ? true : alert.level === activeLevel;
      const matchesRiskLevel = matchesRiskLevelFilter(alert, riskLevel);
      const matchesRegion = matchesRegionFilter(alert, region);
      const matchesBusinessUnit = matchesBusinessUnitFilter(alert, businessUnit);
      const matchesScope = matchesScopeFilter(alert, scope);
      const matchesStatus = matchesStatusFilter(alert, status);

      return (
        matchesSearch &&
        matchesLayer &&
        matchesLegendLevel &&
        matchesRiskLevel &&
        matchesRegion &&
        matchesBusinessUnit &&
        matchesScope &&
        matchesStatus
      );
    });
  }, [
    alerts,
    normalizedSearch,
    activeLayer,
    activeLevel,
    riskLevel,
    region,
    businessUnit,
    scope,
    status,
  ]);

  const visibleAlerts = useMemo(() => {
    return filteredAlerts.filter((alert) => alert.status !== "resolved");
  }, [filteredAlerts]);

  // 1. Move selectedAlert UP so mapVisibleAlerts can use it
  const selectedAlert = useMemo(() => {
    return alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  }, [alerts, selectedAlertId]);

  const mapVisibleAlerts = useMemo(() => {
    const deduped = dedupeHighestRiskPerLocation(visibleAlerts);

    // 2. If an alert is selected, forcefully inject it into the map data 
    // to override the "Critical" pin at that specific location.
    if (selectedAlert && selectedAlert.isMapBacked) {
      const key = `${selectedAlert.location}|${selectedAlert.country}`;
      const filtered = deduped.filter(a => `${a.location}|${a.country}` !== key);
      return [...filtered, selectedAlert];
    }

    return deduped;
  }, [visibleAlerts, selectedAlert]);


  const notificationAlerts = useMemo(() => {
    return alerts.filter((alert) => alert.status === "active");
  }, [alerts]);

  async function handleStatusChange(
    id: string,
    newStatus: "acknowledged" | "resolved"
  ) {
    try {
      await updateAlertStatus(id, newStatus);

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === id ? { ...alert, status: newStatus } : alert
        )
      );
    } catch (err) {
      console.error("Failed to update alert status:", err);
    }
  }

  const isRailOpen = !!selectedAlert;

  if (isLoading) {
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
          <div className="text-slate-400">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
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
          <div className="text-rose-400">{error}</div>
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
            riskLevel={riskLevel}
            onRiskLevelChange={setRiskLevel}
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
                  className="shrink-0 overflow-hidden"
                >
                  <div className="w-[340px]">
                    <RightRail
                      selectedAlert={selectedAlert}
                      isOpen={isRailOpen}
                      onClose={() => setSelectedAlertId(null)}
                    />
                  </div>
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
            />
          </div>

          <MidCardsSection
            supplierExposureData={supplierExposureData}
            lanePressureData={lanePressureData}
            forecastData={forecastData}
            analyticsOverview={analyticsOverview}
            isLoading={midIsLoading}
          />
          <BottomSection selectedAlertId={selectedAlertId} />
        </section>
      </div>
    </div>
  );
}