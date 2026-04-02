"use client";

import KpiCard from "./KpiCard";
import type { KpiItem } from "@/lib/mappers";

type KpiGridProps = {
  kpis: KpiItem[];
};

export default function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          trend={kpi.trend}
          risk={kpi.risk}
        />
      ))}
    </div>
  );
}