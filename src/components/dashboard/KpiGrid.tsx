"use client";

import KpiCard from "./KpiCard";
import type { KpiItem } from "@/lib/dashboard-data";

type KpiGridProps = {
  kpis: KpiItem[];
  activeKpi: string | null;
  onKpiClick: (title: string) => void;
};

export default function KpiGrid({
  kpis,
  activeKpi,
  onKpiClick,
}: KpiGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          trend={kpi.trend}
          series={kpi.series}
          active={activeKpi === kpi.title}
          onClick={() => onKpiClick(kpi.title)}
        />
      ))}
    </div>
  );
}