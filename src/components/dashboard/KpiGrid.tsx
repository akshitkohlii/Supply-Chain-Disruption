import KpiCard from "./KpiCard";
import { kpis } from "@/lib/dashboard-data";

export default function KpiGrid() {
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
        />
      ))}
    </div>
  );
}