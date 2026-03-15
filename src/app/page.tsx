import SearchFilters from "@/components/dashboard/SearchFilters";
import KpiGrid from "@/components/dashboard/KpiGrid";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <section className="space-y-6">
        <SearchFilters />
        <KpiGrid />
      </section>
    </div>
  );
}
