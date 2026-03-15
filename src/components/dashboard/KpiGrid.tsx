import { kpis } from "@/lib/dashboard-data";
import KpiCard from "./KpiCard";

export default function KpiGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
      {kpis.map((title, idx) => (
        <KpiCard key={title} title={title} accent={idx} />
      ))}
    </div>
  );
}
