"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import Panel from "@/components/dashboard/Panel";
import {
  getLanePressure,
  getLogisticsOverview,
  getLogisticsTimeseries,
  type ApiLanePressureItem,
  type ApiLogisticsOverview,
  type ApiLogisticsTimeSeriesPoint,
} from "@/lib/api";

type SortMode = "pressure-desc" | "delay-desc" | "throughput-desc" | "shipments-desc";
type FilterMode = "all" | "high-pressure" | "high-delay" | "low-throughput";

const DAY_LABELS: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

export default function LogisticsPage() {
  const [sortMode, setSortMode] = useState<SortMode>("pressure-desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedLane, setSelectedLane] = useState<string | null>(null);
  const [overview, setOverview] = useState<ApiLogisticsOverview | null>(null);
  const [timeSeries, setTimeSeries] = useState<ApiLogisticsTimeSeriesPoint[]>([]);
  const [lanePressure, setLanePressure] = useState<ApiLanePressureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [overviewResult, timeSeriesResult, laneResult] = await Promise.allSettled([
          getLogisticsOverview(),
          getLogisticsTimeseries(),
          getLanePressure(),
        ]);

        if (cancelled) return;

        const nextOverview =
          overviewResult.status === "fulfilled" ? overviewResult.value : null;
        const nextTimeSeries =
          timeSeriesResult.status === "fulfilled" ? timeSeriesResult.value : [];
        const nextLaneData =
          laneResult.status === "fulfilled" ? laneResult.value : [];

        setOverview(nextOverview);
        setTimeSeries(nextTimeSeries);
        setLanePressure(nextLaneData);
        setSelectedLane((current) => current ?? nextLaneData[0]?.lane ?? null);

        const failures = [
          overviewResult.status === "rejected" ? "overview" : null,
          timeSeriesResult.status === "rejected" ? "time series" : null,
          laneResult.status === "rejected" ? "lane pressure" : null,
        ].filter(Boolean);

        if (failures.length === 3) {
          const firstError =
            (overviewResult.status === "rejected" && overviewResult.reason) ||
            (timeSeriesResult.status === "rejected" && timeSeriesResult.reason) ||
            (laneResult.status === "rejected" && laneResult.reason);
          setError(
            firstError instanceof Error
              ? firstError.message
              : "Failed to load logistics data."
          );
        } else if (failures.length > 0) {
          setError(`Some logistics panels failed to load: ${failures.join(", ")}.`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const processedTimeSeries = useMemo(() => {
    return timeSeries.map((item) => ({
      ...item,
      dayLabel: DAY_LABELS[item.day] ?? item.day.slice(0, 3).toUpperCase(),
      delay: Number(item.avg_delay_hours.toFixed(1)),
      throughput: Number(item.throughput_pct.toFixed(1)),
    }));
  }, [timeSeries]);

  const filteredLanes = useMemo(() => {
    const rows = lanePressure.filter((item) => {
      if (filterMode === "high-pressure") return item.pressure_score >= 60;
      if (filterMode === "high-delay") return item.delay_hours >= 20;
      if (filterMode === "low-throughput") return item.throughput_pct <= 60;
      return true;
    });

    rows.sort((a, b) => {
      if (sortMode === "delay-desc") return b.delay_hours - a.delay_hours;
      if (sortMode === "throughput-desc") return b.throughput_pct - a.throughput_pct;
      if (sortMode === "shipments-desc") return b.shipment_count - a.shipment_count;
      return b.pressure_score - a.pressure_score;
    });

    return rows;
  }, [filterMode, lanePressure, sortMode]);

  const selectedLaneData = useMemo(() => {
    return filteredLanes.find((item) => item.lane === selectedLane) ?? filteredLanes[0] ?? null;
  }, [filteredLanes, selectedLane]);

  const laneChartData = useMemo(() => {
    return filteredLanes.slice(0, 8).map((item) => ({
      lane: compactLaneLabel(item.origin_port, item.destination_port),
      pressure: Number(item.pressure_score.toFixed(1)),
      delay: Number(item.delay_hours.toFixed(1)),
      throughput: Number(item.throughput_pct.toFixed(1)),
      selected: item.lane === selectedLaneData?.lane,
    }));
  }, [filteredLanes, selectedLaneData]);

  const kpis = {
    totalShipments: overview?.total_shipments ?? 0,
    avgDelay: overview?.avg_delay_hours ?? 0,
    avgThroughput: overview?.avg_throughput_pct ?? 0,
    peakDelayDay: overview?.peak_delay_day?.day ?? "N/A",
  };

  return (
    <PageShell
      header={
        <PageHeader
          title="Logistics"
          description="Track live transport strain with interactive lane pressure views, weekly throughput curves, and lane-level spotlight analysis."
        />
      }
    >
      <PageSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <LogisticsStatCard
            title="Tracked Shipment Volume"
            value={`${kpis.totalShipments}`}
            subtitle="Current operational sample"
            tone="neutral"
          />
          <LogisticsStatCard
            title="Average Lane Delay"
            value={`${kpis.avgDelay.toFixed(1)}h`}
            subtitle="Across active lanes"
            tone={getTone(kpis.avgDelay * 3)}
          />
          <LogisticsStatCard
            title="Average Lane Throughput"
            value={`${kpis.avgThroughput.toFixed(1)}%`}
            subtitle="Expected vs actual execution"
            tone={getTone(100 - kpis.avgThroughput)}
          />
          <LogisticsStatCard
            title="Worst Delay Day"
            value={kpis.peakDelayDay}
            subtitle={
              overview?.peak_delay_day
                ? `${overview.peak_delay_day.avg_delay_hours.toFixed(1)}h average delay`
                : "No peak day available"
            }
            tone="neutral"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Logistics Flow Monitor" className="xl:col-span-8">
            {loading ? (
              <PageMessage message="Loading logistics flow..." />
            ) : error ? (
              <PageMessage message={error} isError />
            ) : !processedTimeSeries.length ? (
              <PageMessage message="No logistics time-series available." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <FilterBlock
                    label="Filter Lanes"
                    value={filterMode}
                    onChange={(value) => setFilterMode(value as FilterMode)}
                    options={[
                      { value: "all", label: "All lanes" },
                      { value: "high-pressure", label: "High pressure" },
                      { value: "high-delay", label: "High delay" },
                      { value: "low-throughput", label: "Low throughput" },
                    ]}
                  />
                  <FilterBlock
                    label="Sort View"
                    value={sortMode}
                    onChange={(value) => setSortMode(value as SortMode)}
                    options={[
                      { value: "pressure-desc", label: "Pressure" },
                      { value: "delay-desc", label: "Delay" },
                      { value: "throughput-desc", label: "Throughput" },
                      { value: "shipments-desc", label: "Shipments" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("all");
                      setSortMode("pressure-desc");
                      setSelectedLane(lanePressure[0]?.lane ?? null);
                    }}
                    className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    Reset View
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="h-[320px] rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Weekly Operations Pulse
                        </div>
                        <div className="mt-1 text-sm text-slate-300">
                          Delay trend against throughput stability
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedTimeSeries} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="delayAreaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#f97316" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="dayLabel" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(2,6,23,0.96)",
                            border: "1px solid rgba(30,41,59,0.95)",
                            borderRadius: 16,
                            color: "#e2e8f0",
                          }}
                        />
                        <Area type="monotone" dataKey="delay" stroke="#f97316" fill="url(#delayAreaFill)" strokeWidth={2} />
                        <Area type="monotone" dataKey="throughput" stroke="#22d3ee" fill="transparent" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Delay Distribution
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <DistributionCard label="Low" value={overview?.delay_distribution.low ?? 0} tone="low" />
                      <DistributionCard label="Medium" value={overview?.delay_distribution.medium ?? 0} tone="medium" />
                      <DistributionCard label="High" value={overview?.delay_distribution.high ?? 0} tone="high" />
                    </div>
                    <div className="mt-6 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Lane Pressure Index
                    </div>
                    <div className="mt-4 h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={laneChartData} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis dataKey="lane" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(2,6,23,0.96)",
                              border: "1px solid rgba(30,41,59,0.95)",
                              borderRadius: 16,
                              color: "#e2e8f0",
                            }}
                          />
                          <Bar dataKey="pressure" radius={[8, 8, 0, 0]}>
                            {laneChartData.map((item) => (
                              <Cell
                                key={item.lane}
                                fill={item.selected ? "#f97316" : item.pressure >= 70 ? "#fb7185" : item.pressure >= 45 ? "#facc15" : "#22d3ee"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Selected Lane Spotlight" className="xl:col-span-4">
            {loading ? (
              <PageMessage message="Loading lane spotlight..." />
            ) : error ? (
              <PageMessage message={error} isError />
            ) : !selectedLaneData ? (
              <PageMessage message="No lane selected." />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Selected Lane
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {selectedLaneData.origin_port} → {selectedLaneData.destination_port}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{selectedLaneData.shipment_count} shipments tracked</div>
                </div>

                <SpotlightMetric label="Pressure Score" value={selectedLaneData.pressure_score} />
                <SpotlightMetric label="Delay Hours" value={selectedLaneData.delay_hours} suffix="h" />
                <SpotlightMetric label="Throughput" value={selectedLaneData.throughput_pct} suffix="%" invert />

                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Operational Read
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    {buildLaneNarrative(selectedLaneData)}
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Active Lane Operations Board">
          {loading ? (
            <PageMessage message="Loading lane board..." />
          ) : error ? (
            <PageMessage message={error} isError />
          ) : !filteredLanes.length ? (
            <PageMessage message="No lane data available for the current filter." />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredLanes.map((item) => {
                const active = item.lane === selectedLaneData?.lane;
                return (
                  <button
                    key={item.lane}
                    type="button"
                    onClick={() => setSelectedLane(item.lane)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-orange-400/40 bg-orange-500/10"
                        : "border-slate-800/70 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {item.origin_port} → {item.destination_port}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.shipment_count} shipments · lane pressure {item.pressure_score.toFixed(1)}
                        </div>
                      </div>
                      <SeverityChip value={item.pressure_score} />
                    </div>

                    <div className="mt-4 space-y-3">
                      <MiniBar label="Delay" value={item.delay_hours} suffix="h" />
                      <MiniBar label="Throughput" value={item.throughput_pct} suffix="%" invert />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </PageSection>
    </PageShell>
  );
}

function compactLaneLabel(origin: string, destination: string) {
  return `${shortPort(origin)}-${shortPort(destination)}`;
}

function shortPort(port: string) {
  return String(port || "")
    .replace(/^Port of\s+/i, "")
    .replace(/\s+Port$/i, "")
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 6);
}

function getTone(value: number): "high" | "medium" | "low" {
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

function buildLaneNarrative(item: ApiLanePressureItem) {
  if (item.pressure_score >= 70) {
    return `This lane is under visible execution stress. Delay is elevated at ${item.delay_hours.toFixed(1)} hours, and current throughput is only ${item.throughput_pct.toFixed(1)}%, which suggests intervention is needed before disruption spreads downstream.`;
  }
  if (item.delay_hours >= 20) {
    return `This lane shows rising delay pressure with slower-than-target movement. Throughput remains partially intact, but the lane is vulnerable if congestion or customs friction increases.`;
  }
  return `This lane is operating in a relatively controlled band. Delay and throughput are still within a manageable range, though it should remain under watch if shipment volume increases.`;
}

function PageMessage({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div className={`min-h-[160px] text-sm ${isError ? "text-rose-300" : "text-slate-400"} flex items-center justify-center`}>
      {message}
    </div>
  );
}

function LogisticsStatCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "high" | "medium" | "low" | "neutral";
}) {
  const ui =
    tone === "high"
      ? { border: "border-rose-400/20", glow: "from-rose-500/12 via-rose-500/4", text: "text-rose-300" }
      : tone === "medium"
      ? { border: "border-amber-400/20", glow: "from-amber-400/12 via-amber-400/4", text: "text-amber-300" }
      : tone === "low"
      ? { border: "border-cyan-400/20", glow: "from-cyan-400/12 via-cyan-400/4", text: "text-cyan-300" }
      : { border: "border-slate-700/70", glow: "from-slate-500/8 via-slate-500/3", text: "text-slate-300" };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-slate-950/60 p-4 ${ui.border}`}>
      <div className={`pointer-events-none absolute inset-0 bg-linear-to-r ${ui.glow} to-transparent`} />
      <div className="relative">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className={`mt-1 text-sm ${ui.text}`}>{subtitle}</div>
      </div>
    </div>
  );
}

function FilterBlock({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-slate-600"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DistributionCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "high" | "medium" | "low";
}) {
  const cls =
    tone === "high"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-300"
      : tone === "medium"
      ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
      : "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function SpotlightMetric({
  label,
  value,
  suffix = "",
  invert = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const severityValue = invert ? 100 - clampedValue : clampedValue;
  const barClass =
    severityValue >= 70
      ? "bg-rose-400"
      : severityValue >= 40
      ? "bg-amber-400"
      : "bg-cyan-400";

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-white">
          {value.toFixed(1)}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${barClass}`} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}

function SeverityChip({ value }: { value: number }) {
  const cls =
    value >= 70
      ? "border-rose-400/20 bg-rose-500/10 text-rose-300"
      : value >= 45
      ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
      : "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${cls}`}>
      {value >= 70 ? "critical" : value >= 45 ? "watch" : "stable"}
    </span>
  );
}

function MiniBar({
  label,
  value,
  suffix,
  invert = false,
}: {
  label: string;
  value: number;
  suffix: string;
  invert?: boolean;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const severityValue = invert ? 100 - clampedValue : clampedValue;
  const tone =
    severityValue >= 70
      ? "bg-rose-400"
      : severityValue >= 40
      ? "bg-amber-400"
      : "bg-cyan-400";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="text-slate-300">
          {value.toFixed(1)}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${tone}`} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}
