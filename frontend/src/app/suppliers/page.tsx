"use client";

import { useMemo, useState } from "react";
import Panel from "@/components/dashboard/Panel";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import { supplierRiskData } from "@/lib/dashboard-data";

type SupplierSort = "risk-desc" | "risk-asc" | "dependency-desc" | "dependency-asc";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [selectedDistribution, setSelectedDistribution] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [sortBy, setSortBy] = useState<SupplierSort>("risk-desc");

  const avgRisk = Math.round(
    supplierRiskData.reduce((sum, s) => sum + s.risk, 0) / supplierRiskData.length
  );

  const avgDependency = Math.round(
    supplierRiskData.reduce((sum, s) => sum + s.dependency, 0) /
      supplierRiskData.length
  );

  const distribution = useMemo(() => {
    const high = supplierRiskData.filter((s) => s.risk >= 70).length;
    const medium = supplierRiskData.filter((s) => s.risk >= 40 && s.risk < 70).length;
    const low = supplierRiskData.filter((s) => s.risk < 40).length;
    const total = supplierRiskData.length;

    return {
      high,
      medium,
      low,
      total,
      highPct: total ? Math.round((high / total) * 100) : 0,
      mediumPct: total ? Math.round((medium / total) * 100) : 0,
      lowPct: total ? Math.round((low / total) * 100) : 0,
    };
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let data = supplierRiskData.filter((s) =>
      s.supplier.toLowerCase().includes(q)
    );

    if (selectedDistribution === "high") {
      data = data.filter((s) => s.risk >= 70);
    } else if (selectedDistribution === "medium") {
      data = data.filter((s) => s.risk >= 40 && s.risk < 70);
    } else if (selectedDistribution === "low") {
      data = data.filter((s) => s.risk < 40);
    }

    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case "risk-desc":
          return b.risk - a.risk;
        case "risk-asc":
          return a.risk - b.risk;
        case "dependency-desc":
          return b.dependency - a.dependency;
        case "dependency-asc":
          return a.dependency - b.dependency;
        default:
          return 0;
      }
    });

    return data;
  }, [search, selectedDistribution, sortBy]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Supplier Risk Overview"
          description="Monitor supplier exposure, dependency concentration, and disruption risk across the supplier base."
        />
      }
    >
      <PageSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SupplierKpiCard
            title="Avg Risk Score"
            value={avgRisk}
            tone={avgRisk >= 70 ? "high" : avgRisk >= 40 ? "medium" : "low"}
            subtitle="Portfolio-wide supplier risk"
          />
          <SupplierKpiCard
            title="High Risk Suppliers"
            value={distribution.high}
            tone={distribution.high >= 3 ? "high" : distribution.high >= 1 ? "medium" : "low"}
            subtitle={`${distribution.highPct}% of supplier base`}
          />
          <SupplierKpiCard
            title="Avg Dependency"
            value={avgDependency}
            tone={
              avgDependency >= 75 ? "high" : avgDependency >= 50 ? "medium" : "low"
            }
            subtitle="Concentration / reliance score"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Supplier Risk Table" className="xl:col-span-8">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                placeholder="Search supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SupplierSort)}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400/30"
              >
                <option value="risk-desc">Risk: High to Low</option>
                <option value="risk-asc">Risk: Low to High</option>
                <option value="dependency-desc">Dependency: High to Low</option>
                <option value="dependency-asc">Dependency: Low to High</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800/70">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-x-8 bg-slate-950/70 px-5 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                <div>Supplier</div>
                <div>Risk</div>
                <div>Dependency</div>
              </div>

              <div className="divide-y divide-slate-800/70">
                {filteredSuppliers.map((s) => (
                  <div
                    key={s.supplier}
                    className="grid grid-cols-[1.1fr_1fr_1fr] items-center gap-x-8 px-5 py-4 text-sm transition hover:bg-slate-900/40"
                  >
                    <div className="font-medium text-white">Supplier {s.supplier}</div>

                    <MetricBar value={s.risk} />

                    <MetricBar value={s.dependency} />
                  </div>
                ))}

                {filteredSuppliers.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">
                    No suppliers matched your filters.
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Risk Distribution" className="xl:col-span-4">
            <div className="space-y-3">
              <DistributionCard
                label="High Risk"
                value={distribution.high}
                percent={distribution.highPct}
                tone="high"
                active={selectedDistribution === "high"}
                onClick={() =>
                  setSelectedDistribution((prev) => (prev === "high" ? "all" : "high"))
                }
              />
              <DistributionCard
                label="Medium Risk"
                value={distribution.medium}
                percent={distribution.mediumPct}
                tone="medium"
                active={selectedDistribution === "medium"}
                onClick={() =>
                  setSelectedDistribution((prev) =>
                    prev === "medium" ? "all" : "medium"
                  )
                }
              />
              <DistributionCard
                label="Low Risk"
                value={distribution.low}
                percent={distribution.lowPct}
                tone="low"
                active={selectedDistribution === "low"}
                onClick={() =>
                  setSelectedDistribution((prev) => (prev === "low" ? "all" : "low"))
                }
              />

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Active Filter
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {selectedDistribution === "all"
                      ? "All suppliers"
                      : `${selectedDistribution[0].toUpperCase()}${selectedDistribution.slice(
                          1
                        )} risk suppliers`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistribution("all")}
                    className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </PageSection>
    </PageShell>
  );
}

function SupplierKpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: "high" | "medium" | "low";
}) {
  const ui =
    tone === "high"
      ? {
          border: "border-rose-400/20",
          bg: "from-rose-500/10 via-rose-500/4 to-transparent",
          text: "text-rose-300",
          dot: "bg-rose-400",
        }
      : tone === "medium"
      ? {
          border: "border-amber-400/20",
          bg: "from-amber-400/10 via-amber-400/4 to-transparent",
          text: "text-amber-300",
          dot: "bg-amber-400",
        }
      : {
          border: "border-cyan-400/20",
          bg: "from-cyan-400/10 via-cyan-400/4 to-transparent",
          text: "text-cyan-300",
          dot: "bg-cyan-400",
        };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-slate-950/60 p-4 ${ui.border}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-linear-to-r ${ui.bg}`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {title}
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`} />
        </div>

        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className={`mt-1 text-sm ${ui.text}`}>{subtitle}</div>
      </div>
    </div>
  );
}

function MetricBar({ value }: { value: number }) {
  const tone =
    value >= 70
      ? {
          fill: "bg-rose-400",
          text: "text-rose-300",
        }
      : value >= 40
      ? {
          fill: "bg-amber-400",
          text: "text-amber-300",
        }
      : {
          fill: "bg-cyan-400",
          text: "text-cyan-300",
        };

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${tone.fill}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`min-w-8 text-right font-medium ${tone.text}`}>
        {value}
      </span>
    </div>
  );
}

function DistributionCard({
  label,
  value,
  percent,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  percent: number;
  tone: "high" | "medium" | "low";
  active: boolean;
  onClick: () => void;
}) {
  const ui =
    tone === "high"
      ? {
          dot: "bg-rose-400",
          text: "text-rose-300",
          bar: "bg-rose-400",
          active: "border-rose-400/30 bg-rose-500/8",
        }
      : tone === "medium"
      ? {
          dot: "bg-amber-400",
          text: "text-amber-300",
          bar: "bg-amber-400",
          active: "border-amber-400/30 bg-amber-500/8",
        }
      : {
          dot: "bg-cyan-400",
          text: "text-cyan-300",
          bar: "bg-cyan-400",
          active: "border-cyan-400/30 bg-cyan-500/8",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? ui.active
          : "border-slate-800/80 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900/50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`} />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className={`text-sm font-medium ${ui.text}`}>{value}</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${ui.bar}`} style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-500">Share of suppliers</span>
        <span className="text-slate-300">{percent}%</span>
      </div>
    </button>
  );
}