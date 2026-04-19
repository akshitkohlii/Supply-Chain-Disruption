"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
  getAnalyticsOverview,
  getAnalyticsTimeSeries,
  getLanePressure,
  getSupplierExposure,
  type ApiAnalyticsOverview,
  type ApiAnalyticsTimeSeriesPoint,
  type ApiLanePressureItem,
  type ApiSupplierExposureItem,
} from "@/lib/api";

type FocusMode = "all" | "forecast" | "suppliers" | "logistics";

export default function AnalyticsPage() {
  const [focusMode, setFocusMode] = useState<FocusMode>("all");
  const [selectedPort, setSelectedPort] = useState("");
  const [selectedLane, setSelectedLane] = useState("");
  const [overview, setOverview] = useState<ApiAnalyticsOverview | null>(null);
  const [timeSeries, setTimeSeries] = useState<ApiAnalyticsTimeSeriesPoint[]>([]);
  const [supplierExposure, setSupplierExposure] = useState<ApiSupplierExposureItem[]>([]);
  const [lanePressure, setLanePressure] = useState<ApiLanePressureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        const [overviewData, timeSeriesData, supplierData, laneData] = await Promise.all([
          getAnalyticsOverview(),
          getAnalyticsTimeSeries({
            port: selectedPort || undefined,
            lane: selectedLane || undefined,
          }),
          getSupplierExposure(),
          getLanePressure(),
        ]);

        if (cancelled) return;

        setOverview(overviewData);
        setTimeSeries(timeSeriesData);
        setSupplierExposure(supplierData);
        setLanePressure(laneData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [selectedLane, selectedPort]);

  const avgForecast = Math.round(overview?.avg_forecast_risk ?? 0);
  const forecastDrift = Number((overview?.forecast_drift ?? 0).toFixed(1));
  const avgSupplierRisk = Math.round(overview?.avg_supplier_risk ?? 0);
  const avgDelay = Math.round(overview?.avg_delay_hours ?? 0);
  const criticalAlerts = overview?.critical_alerts ?? 0;

  const timeSeriesRows = useMemo(() => {
    return timeSeries.map((item) => ({
      ...item,
      currentRisk: Number(item.current_risk.toFixed(1)),
      forecastRisk: Number(item.forecast_risk.toFixed(1)),
      weatherScore: Number(item.weather_score.toFixed(1)),
      newsScore: Number(item.news_score.toFixed(1)),
      congestionScore: Number(item.congestion_score.toFixed(1)),
      logisticsScore: Number(item.logistics_score.toFixed(1)),
      emergingScore: Number(item.emerging_score.toFixed(1)),
      driftValue: Number(item.drift.toFixed(1)),
      label: `${item.day} ${item.date.slice(5)}`,
    }));
  }, [timeSeries]);

  const supplierExposureRows = useMemo(() => {
    return supplierExposure
      .map((item) => ({
        ...item,
        combined: Math.round((item.risk_score + item.dependency_score) / 2),
      }))
      .sort((a, b) => b.combined - a.combined)
      .slice(0, 6);
  }, [supplierExposure]);

  const logisticsRows = useMemo(() => {
    return lanePressure
      .map((item) => ({
        ...item,
        label: `${item.origin_port}-${item.destination_port}`,
      }))
      .sort((a, b) => b.pressure_score - a.pressure_score)
      .slice(0, 6);
  }, [lanePressure]);

  const portOptions = useMemo(() => {
    const ports = new Set<string>();
    lanePressure.forEach((item) => {
      if (item.origin_port) ports.add(item.origin_port);
      if (item.destination_port) ports.add(item.destination_port);
    });
    return Array.from(ports).sort((a, b) => a.localeCompare(b));
  }, [lanePressure]);

  const laneOptions = useMemo(() => {
    return lanePressure
      .map((item) => ({
        label: `${item.origin_port} → ${item.destination_port}`,
        value: item.lane,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [lanePressure]);

  const driverPeaks = useMemo(() => {
    if (!timeSeriesRows.length) {
      return [
        { label: "Weather", value: 0, tone: "low" as const },
        { label: "News", value: 0, tone: "low" as const },
        { label: "Congestion", value: 0, tone: "low" as const },
      ];
    }

    const maxWeather = Math.max(...timeSeriesRows.map((item) => item.weatherScore));
    const maxNews = Math.max(...timeSeriesRows.map((item) => item.newsScore));
    const maxCongestion = Math.max(...timeSeriesRows.map((item) => item.congestionScore));

    return [
      { label: "Weather Peak", value: maxWeather, tone: getTone(maxWeather) },
      { label: "News Peak", value: maxNews, tone: getTone(maxNews) },
      { label: "Congestion Peak", value: maxCongestion, tone: getTone(maxCongestion) },
    ];
  }, [timeSeriesRows]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Analytics"
          description="Track live risk time series, supplier exposure, and logistics pressure from current route snapshots."
        />
      }
    >
      <PageSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <AnalyticsKpiCard
            title="Average Modeled Route Risk"
            value={`${avgForecast}`}
            subtitle="Latest modeled route risk"
            tone={getTone(avgForecast)}
          />
          <AnalyticsKpiCard
            title="Model vs Observed Drift"
            value={`${forecastDrift > 0 ? "+" : ""}${forecastDrift}`}
            subtitle="Modeled vs observed"
            tone={getTone(Math.abs(forecastDrift) * 6)}
          />
          <AnalyticsKpiCard
            title="Average Supplier Exposure"
            value={`${avgSupplierRisk}`}
            subtitle="Supplier exposure baseline"
            tone={getTone(avgSupplierRisk)}
          />
          <AnalyticsKpiCard
            title="Critical Route Snapshots"
            value={`${criticalAlerts}`}
            subtitle={`${avgDelay}h avg route delay`}
            tone={getTone(criticalAlerts * 25)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Risk Snapshot Time Series" className="xl:col-span-8">
            {isLoading ? (
              <AnalyticsEmptyState message="Loading time-series analysis..." />
            ) : error ? (
              <AnalyticsEmptyState message={error} isError />
            ) : !timeSeriesRows.length ? (
              <AnalyticsEmptyState message="No time-series data available yet." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <label className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Filter By Port
                    </div>
                    <select
                      value={selectedPort}
                      onChange={(event) => {
                        setSelectedPort(event.target.value);
                        if (selectedLane) setSelectedLane("");
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-slate-600"
                    >
                      <option value="">All ports</option>
                      {portOptions.map((port) => (
                        <option key={port} value={port}>
                          {port}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Filter By Lane
                    </div>
                    <select
                      value={selectedLane}
                      onChange={(event) => {
                        setSelectedLane(event.target.value);
                        if (selectedPort) setSelectedPort("");
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-slate-600"
                    >
                      <option value="">All lanes</option>
                      {laneOptions.map((lane) => (
                        <option key={lane.value} value={lane.value}>
                          {lane.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPort("");
                      setSelectedLane("");
                    }}
                    className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    Reset Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {driverPeaks.map((item) => (
                    <FocusCard
                      key={item.label}
                      title={item.label}
                      value={`${item.value.toFixed(1)}`}
                      subtitle="Highest daily average in the current window"
                      active={false}
                      tone={item.tone}
                      onClick={() => {}}
                    />
                  ))}
                </div>

                <div className="h-[340px] rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesRows} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="riskSeriesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                      <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(2,6,23,0.96)",
                          border: "1px solid rgba(30,41,59,0.95)",
                          borderRadius: 16,
                          color: "#e2e8f0",
                        }}
                      />
                      <Area type="monotone" dataKey="currentRisk" stroke="#38bdf8" strokeWidth={2} fill="url(#riskSeriesFill)" />
                      <Line type="monotone" dataKey="forecastRisk" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="weatherScore" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="newsScore" stroke="#facc15" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="congestionScore" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Driver Mix
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        { label: "Weather", value: latestValue(timeSeriesRows, "weatherScore") },
                        { label: "News", value: latestValue(timeSeriesRows, "newsScore") },
                        { label: "Congestion", value: latestValue(timeSeriesRows, "congestionScore") },
                        { label: "Logistics", value: latestValue(timeSeriesRows, "logisticsScore") },
                        { label: "Emerging", value: latestValue(timeSeriesRows, "emergingScore") },
                      ].map((item) => (
                        <MiniMetric key={item.label} label={item.label} value={`${item.value.toFixed(1)}`} raw={item.value} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Daily Analysis Table
                    </div>
                    <div className="mt-4 space-y-3">
                      {timeSeriesRows.slice(-5).reverse().map((item) => (
                        <div
                          key={item.date}
                          className="rounded-xl border border-slate-800/70 bg-slate-950/55 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white">{item.label}</div>
                              <div className="text-xs text-slate-500">{item.route_count} active routes sampled</div>
                            </div>
                            <DriftBadge value={item.driftValue} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                            <div>Current: <span className="text-slate-200">{item.currentRisk}</span></div>
                            <div>Forecast: <span className="text-slate-200">{item.forecastRisk}</span></div>
                            <div>Weather: <span className="text-slate-200">{item.weatherScore}</span></div>
                            <div>News: <span className="text-slate-200">{item.newsScore}</span></div>
                            <div>Congestion: <span className="text-slate-200">{item.congestionScore}</span></div>
                            <div>Emerging: <span className="text-slate-200">{item.emergingScore}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Analysis Focus Controls" className="xl:col-span-4">
            <div className="space-y-3">
              <FocusCard
                title="Forecast Signals"
                value={`${avgForecast}`}
                subtitle="Observed vs modeled route movement"
                active={focusMode === "forecast"}
                tone="high"
                onClick={() =>
                  setFocusMode((prev) => (prev === "forecast" ? "all" : "forecast"))
                }
              />
              <FocusCard
                title="Supplier Exposure"
                value={`${avgSupplierRisk}`}
                subtitle="Risk and dependency concentration"
                active={focusMode === "suppliers"}
                tone="medium"
                onClick={() =>
                  setFocusMode((prev) => (prev === "suppliers" ? "all" : "suppliers"))
                }
              />
              <FocusCard
                title="Logistics Pressure"
                value={`${avgDelay}h`}
                subtitle="Lane delay and throughput strain"
                active={focusMode === "logistics"}
                tone="low"
                onClick={() =>
                  setFocusMode((prev) => (prev === "logistics" ? "all" : "logistics"))
                }
              />

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Active Focus
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-300 capitalize">
                    {focusMode === "all" ? "All analytics views" : focusMode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusMode("all");
                      setSelectedPort("");
                      setSelectedLane("");
                    }}
                    className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Highest Supplier Exposure" className="xl:col-span-6">
            <div className="space-y-3">
              {supplierExposureRows.map((item) => (
                <InsightMetricRow
                  key={item.supplier_id}
                  label={item.supplier_name}
                  value={`${item.combined}`}
                  leftValue={item.risk_score}
                  rightValue={item.dependency_score}
                  leftLabel="Risk"
                  rightLabel="Dependency"
                  dimmed={focusMode !== "all" && focusMode !== "suppliers"}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Top Lane Pressure Snapshot" className="xl:col-span-6">
            <div className="space-y-3">
              {logisticsRows.map((item) => (
                <InsightMetricRow
                  key={item.lane}
                  label={item.label}
                  value={`${Math.round(item.pressure_score)}`}
                  leftValue={item.delay_hours}
                  rightValue={item.throughput_pct}
                  leftLabel="Delay"
                  rightLabel="Throughput"
                  leftSuffix="h"
                  rightSuffix="%"
                  dimmed={focusMode !== "all" && focusMode !== "logistics"}
                />
              ))}
            </div>
          </Panel>
        </div>
      </PageSection>
    </PageShell>
  );
}

function getTone(value: number): "high" | "medium" | "low" {
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

function latestValue(
  items: Array<Record<string, number | string>>,
  key: string
) {
  const last = items[items.length - 1];
  if (!last) return 0;
  return Number(last[key] ?? 0);
}

function AnalyticsEmptyState({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div className={`flex min-h-[220px] items-center justify-center text-sm ${isError ? "text-rose-300" : "text-slate-400"}`}>
      {message}
    </div>
  );
}

function AnalyticsKpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
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
    <div className={`relative overflow-hidden rounded-2xl border bg-slate-950/60 p-4 ${ui.border}`}>
      <div className={`pointer-events-none absolute inset-0 bg-linear-to-r ${ui.bg}`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`} />
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className={`mt-1 text-sm ${ui.text}`}>{subtitle}</div>
      </div>
    </div>
  );
}

function FocusCard({
  title,
  value,
  subtitle,
  active,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  subtitle: string;
  active: boolean;
  tone: "high" | "medium" | "low";
  onClick: () => void;
}) {
  const ui =
    tone === "high"
      ? "border-rose-400/30 bg-rose-500/8 text-rose-300"
      : tone === "medium"
      ? "border-amber-400/30 bg-amber-500/8 text-amber-300"
      : "border-cyan-400/30 bg-cyan-500/8 text-cyan-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? ui
          : "border-slate-800/80 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-900/50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="mt-2 text-xs text-slate-400">{subtitle}</div>
    </button>
  );
}

function DriftBadge({ value }: { value: number }) {
  const cls =
    value >= 10
      ? "border-rose-400/20 bg-rose-500/10 text-rose-300"
      : value >= 5
      ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
      : "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

function InsightMetricRow({
  label,
  value,
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  leftSuffix = "",
  rightSuffix = "",
  dimmed = false,
}: {
  label: string;
  value: string;
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  leftSuffix?: string;
  rightSuffix?: string;
  dimmed?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-800/70 bg-slate-950/45 p-4 transition ${dimmed ? "opacity-45" : "opacity-100"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="text-sm font-semibold text-slate-200">{value}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <MiniMetric label={leftLabel} value={`${leftValue}${leftSuffix}`} raw={leftValue} />
        <MiniMetric label={rightLabel} value={`${rightValue}${rightSuffix}`} raw={rightValue} />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  raw,
}: {
  label: string;
  value: string;
  raw: number;
}) {
  const tone =
    raw >= 70
      ? "bg-rose-400"
      : raw >= 40
      ? "bg-amber-400"
      : "bg-cyan-400";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="text-slate-300">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(raw, 100)}%` }} />
      </div>
    </div>
  );
}
