"use client";

import { useMemo, useState } from "react";

import SearchFilters from "@/components/dashboard/SearchFilters";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MainMapSection from "@/components/dashboard/MainMapSection";
import MidCardsSection from "@/components/dashboard/MidCardsSection";
import BottomSection from "@/components/dashboard/BottomSection";
import RightRail from "@/components/dashboard/RightRail";

import { alerts } from "@/lib/dashboard-data";

type LayerFilter = "all" | "supplier" | "port" | "climate" | "geo" | "logistics";
type LevelFilter = "all" | "stable" | "warning" | "critical";

export default function DashboardPage() {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<LayerFilter>("all");
  const [activeLevel, setActiveLevel] = useState<LevelFilter>("all");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesLayer =
        activeLayer === "all" ? true : alert.category === activeLayer;

      const matchesLevel =
        activeLevel === "all" ? true : alert.level === activeLevel;

      return matchesLayer && matchesLevel;
    });
  }, [activeLayer, activeLevel]);

  const selectedAlert = useMemo(() => {
    return filteredAlerts.find((a) => a.id === selectedAlertId) ?? null;
  }, [filteredAlerts, selectedAlertId]);

  const handleKpiClick = (kpiTitle: string) => {
  switch (kpiTitle) {
    case "Critical Alerts":
      setActiveLevel("critical");
      break;

    case "High-Risk Suppliers":
      setActiveLayer("supplier");
      setActiveLevel("warning");
      break;

    case "Delayed Shipments %":
      setActiveLayer("logistics");
      break;

    case "Global Risk Score":
      setActiveLevel("all");
      setActiveLayer("all");
      break;

    case "Avg Time to Recover":
      setActiveLevel("warning");
      break;

    default:
      break;
  }
};

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <section className="space-y-6">
        <SearchFilters />
        <KpiGrid />

        <MainMapSection
          alerts={filteredAlerts}
          selectedAlert={selectedAlert}
          onSelectAlert={(alert) => setSelectedAlertId(alert.id)}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          activeLevel={activeLevel}
          onLevelChange={setActiveLevel}
        />

        <MidCardsSection />
        <BottomSection />
      </section>

      <RightRail />
    </div>
  );
}