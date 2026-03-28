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
  alerts as initialAlerts,
  type AlertStatus,
  buildDashboardKpis,
} from "../lib/dashboard-data";

type LayerFilter = "all" | "supplier" | "port" | "climate" | "geo" | "logistics";
type LevelFilter = "all" | "stable" | "warning" | "critical";
type ScopeFilter = "Global" | "Regional";
type TimeFilter = "Last 24 Hours" | "Last 7 Days" | "Last 30 Days";
type StatusFilter = "All" | "Alerts" | "Acknowledged" | "Resolved";

export default function DashboardPage() {
  const [alertData, setAlertData] = useState(initialAlerts);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateAlertStatus = (id: string, newStatus: AlertStatus) => {
    setAlertData((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status: newStatus } : alert
      )
    );
  };

  const filteredAlerts = useMemo(() => {
    return alertData.filter((alert) => {
      const q = search.trim().toLowerCase();

      const matchesSearch =
        q === ""
          ? true
          : [
              alert.title,
              alert.location,
              alert.country,
              alert.category,
              alert.summary,
              alert.status,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q);

      const matchesLayer =
        activeLayer === "all" ? true : alert.category === activeLayer;

      const matchesLegendLevel =
        activeLevel === "all" ? true : alert.level === activeLevel;

      const matchesRiskLevel =
        riskLevel === "All Levels"
          ? true
          : alert.level === riskLevel.toLowerCase();

      const matchesRegion =
        region === "All Regions"
          ? true
          : region === "Asia"
            ? ["India", "Singapore"].includes(alert.country)
            : region === "Europe"
              ? ["Netherlands"].includes(alert.country)
              : region === "North America"
                ? ["USA"].includes(alert.country)
                : region === "South America"
                  ? ["Brazil"].includes(alert.country)
                  : true;

      const matchesBusinessUnit =
        businessUnit === "All Units"
          ? true
          : businessUnit === "Logistics"
            ? alert.category === "logistics" || alert.category === "port"
            : businessUnit === "Risk"
              ? ["supplier", "geo", "climate"].includes(alert.category)
              : true;

      const matchesScope =
        scope === "Global"
          ? true
          : ["India", "Singapore", "Netherlands"].includes(alert.country);

      const matchesStatus =
        status === "All"
          ? true
          : status === "Alerts"
            ? alert.status === "active"
            : status === "Acknowledged"
              ? alert.status === "acknowledged"
              : alert.status === "resolved";

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
    alertData,
    search,
    region,
    businessUnit,
    riskLevel,
    activeLayer,
    activeLevel,
    scope,
    status,
  ]);

  const visibleAlerts = useMemo(() => {
    return filteredAlerts.filter((alert) => alert.status !== "resolved");
  }, [filteredAlerts]);

  const selectedAlert = useMemo(() => {
    return alertData.find((alert) => alert.id === selectedAlertId) ?? null;
  }, [alertData, selectedAlertId]);

  const notificationAlerts = useMemo(() => {
    return alertData.filter((alert) => alert.status === "active");
  }, [alertData]);

  const derivedKpis = useMemo(() => {
    return buildDashboardKpis(alertData);
  }, [alertData]);

  const isRailOpen = !!selectedAlert;

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

          <KpiGrid kpis={derivedKpis} />

          <div className="hidden items-start gap-6 xl:flex">
            <motion.div
              layout
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-1"
            >
              <MainMapSection
                alerts={visibleAlerts}
                selectedAlert={selectedAlert}
                onSelectAlert={(alert) => setSelectedAlertId(alert?.id ?? null)}
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
                activeLevel={activeLevel}
                onLevelChange={setActiveLevel}
                onAcknowledge={(id) => updateAlertStatus(id, "acknowledged")}
                onResolve={(id) => updateAlertStatus(id, "resolved")}
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
              alerts={visibleAlerts}
              selectedAlert={selectedAlert}
              onSelectAlert={(alert) => setSelectedAlertId(alert?.id ?? null)}
              activeLayer={activeLayer}
              onLayerChange={setActiveLayer}
              activeLevel={activeLevel}
              onLevelChange={setActiveLevel}
              onAcknowledge={(id) => updateAlertStatus(id, "acknowledged")}
              onResolve={(id) => updateAlertStatus(id, "resolved")}
            />
          </div>

          <MidCardsSection />
          <BottomSection selectedAlertId={selectedAlertId} />
        </section>
      </div>
    </div>
  );
}