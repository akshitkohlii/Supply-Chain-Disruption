"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import SearchFilters from "@/components/dashboard/SearchFilters";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MainMapSection from "@/components/dashboard/MainMapSection";
import MidCardsSection from "@/components/dashboard/MidCardsSection";
import BottomSection from "@/components/dashboard/BottomSection";
import RightRail from "@/components/dashboard/RightRail";

import {
  alerts as initialAlerts,
  type AlertStatus,
  buildKpisFromAlerts,
} from "@/lib/dashboard-data";

const Topbar = dynamic(() => import("@/components/dashboard/Topbar"), {
  ssr: false,
});

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
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [businessUnit, setBusinessUnit] = useState("All Units");
  const [riskLevel, setRiskLevel] = useState("All Levels");

  const [scope, setScope] = useState<ScopeFilter>("Global");
  const [timeRange, setTimeRange] = useState<TimeFilter>("Last 7 Days");
  const [status, setStatus] = useState<StatusFilter>("All");

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
          : businessUnit === "Global Ops"
            ? true
            : businessUnit === "Logistics"
              ? alert.category === "logistics" || alert.category === "port"
              : businessUnit === "Risk"
                ? alert.category === "supplier" ||
                alert.category === "geo" ||
                alert.category === "climate"
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

  const selectedAlert = useMemo(() => {
    return alertData.find((a) => a.id === selectedAlertId) ?? null;
  }, [alertData, selectedAlertId]);

  const notificationAlerts = useMemo(() => {
    return alertData.filter((alert) => alert.status === "active");
  }, [alertData]);

  const visibleAlerts = useMemo(() => {
    return filteredAlerts.filter((alert) => alert.status !== "resolved");
  }, [filteredAlerts]);

  const derivedKpis = useMemo(() => {
    return buildKpisFromAlerts(visibleAlerts);
  }, [visibleAlerts]);

  const resetDashboardFilters = () => {
    setActiveLayer("all");
    setActiveLevel("all");
    setRiskLevel("All Levels");
    setStatus("All");
    setSearch("");
    setRegion("All Regions");
    setBusinessUnit("All Units");
    setScope("Global");
    setTimeRange("Last 7 Days");
  };

  const handleKpiClick = (kpiTitle: string) => {
    setActiveKpi((prev) => (prev === kpiTitle ? null : kpiTitle));

    switch (kpiTitle) {
      case "Global Risk Score":
        resetDashboardFilters();
        break;
      case "Critical Alerts":
        setActiveLayer("all");
        setActiveLevel("critical");
        setRiskLevel("Critical");
        setStatus("Alerts");
        break;
      case "High-Risk Suppliers":
        setActiveLayer("supplier");
        setActiveLevel("all");
        setRiskLevel("All Levels");
        setStatus("All");
        break;
      case "Delayed Shipments %":
        setActiveLayer("logistics");
        setActiveLevel("all");
        setRiskLevel("All Levels");
        setStatus("All");
        break;
      case "Avg Time to Recover":
        setActiveLayer("all");
        setActiveLevel("warning");
        setRiskLevel("All Levels");
        setStatus("Resolved");
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-30">
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

      <div className="h-screen overflow-y-auto px-4 pb-6 pt-24 md:px-6">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <SearchFilters
              search={search}
              onSearchChange={setSearch}
              region={region}
              onRegionChange={setRegion}
              businessUnit={businessUnit}
              onBusinessUnitChange={setBusinessUnit}
              riskLevel={riskLevel}
              onRiskLevelChange={setRiskLevel}
            />

            <KpiGrid
              kpis={derivedKpis}
              activeKpi={activeKpi}
              onKpiClick={handleKpiClick}
            />

            <MainMapSection
              alerts={visibleAlerts}
              selectedAlert={selectedAlert}
              onSelectAlert={(alert) => setSelectedAlertId(alert.id)}
              activeLayer={activeLayer}
              onLayerChange={setActiveLayer}
              activeLevel={activeLevel}
              onLevelChange={setActiveLevel}
              onAcknowledge={(id) => updateAlertStatus(id, "acknowledged")}
              onResolve={(id) => updateAlertStatus(id, "resolved")}
            />

            <MidCardsSection />
            <BottomSection selectedAlertId={selectedAlertId} />
          </section>

          <RightRail
            selectedAlert={selectedAlert}
          />
        </div>
      </div>
    </div>
  );
}