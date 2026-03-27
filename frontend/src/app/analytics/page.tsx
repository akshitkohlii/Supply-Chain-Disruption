"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import Panel from "@/components/dashboard/Panel";
import {
  alerts,
  predictiveRiskData,
  supplierRiskData,
  logisticsTransportData,
} from "@/lib/dashboard-data";

type FocusMode = "all" | "forecast" | "suppliers" | "logistics";

export default function AnalyticsPage() {
  const [focusMode, setFocusMode] = useState<FocusMode>("all");

  const avgForecast = Math.round(
    predictiveRiskData.reduce((sum, item) => sum + item.forecast, 0) /
      predictiveRiskData.length
  );

  const avgCurrent = Math.round(
    predictiveRiskData.reduce((sum, item) => sum + item.current, 0) /
      predictiveRiskData.length
  );

  const forecastDrift = avgForecast - avgCurrent;

  const avgSupplierRisk = Math.round(
    supplierRiskData.reduce((sum, item) => sum + item.risk, 0) /
      supplierRiskData.length
  );

  const avgDelay = Math.round(
    logisticsTransportData.reduce((sum, item) => sum + item.delay, 0) /
      logisticsTransportData.length
  );

  const criticalAlerts = alerts.filter((a) => a.level === "critical").length;

  const forecastRows = useMemo(() => {
    return predictiveRiskData.map((item) => ({
      ...item,
      drift: item.forecast - item.current,
    }));
  }, []);

  const supplierExposureRows = useMemo(() => {
    return supplierRiskData
      .map((item) => ({
        ...item,
        combined: Math.round((item.risk + item.dependency) / 2),
      }))
      .sort((a, b) => b.combined - a.combined)
      .slice(0, 6);
  }, []);

  const logisticsRows = useMemo(() => {
    return logisticsTransportData
      .map((item) => ({
        ...item,
        pressure: Math.round((item.delay * 1.2 + (100 - item.throughput)) / 2),
      }))
      .sort((a, b) => b.pressure - a.pressure);
  }, []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Analytics"
          description="Track forecast drift, supplier exposure, and logistics pressure across the control tower."
        />
      }
    >
      <PageSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <AnalyticsKpiCard
            title="Avg Forecast Risk"
            value={`${avgForecast}`}
            subtitle="Predictive model output"
            tone={avgForecast >= 70 ? "high" : avgForecast >= 50 ? "medium" : "low"}
          />
          <AnalyticsKpiCard
            title="Forecast Drift"
            value={`${forecastDrift > 0 ? "+" : ""}${forecastDrift}`}
            subtitle="Forecast vs current"
            tone={forecastDrift >= 12 ? "high" : forecastDrift >= 5 ? "medium" : "low"}
          />
          <AnalyticsKpiCard
            title="Avg Supplier Risk"
            value={`${avgSupplierRisk}`}
            subtitle="Supplier base exposure"
            tone={
              avgSupplierRisk >= 70 ? "high" : avgSupplierRisk >= 50 ? "medium" : "low"
            }
          />
          <AnalyticsKpiCard
            title="Critical Alerts"
            value={`${criticalAlerts}`}
            subtitle={`${avgDelay}h avg logistics delay`}
            tone={criticalAlerts >= 2 ? "high" : criticalAlerts >= 1 ? "medium" : "low"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Forecast Trend Grid" className="xl:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-800/70">
              <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] gap-x-6 bg-slate-950/70 px-5 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                <div>Week</div>
                <div>Current</div>
                <div>Forecast</div>
                <div>Drift</div>
              </div>

              <div className="divide-y divide-slate-800/70">
                {forecastRows.map((item) => (
                  <div
                    key={item.week}
                    className={`grid grid-cols-[0.8fr_1fr_1fr_1fr] items-center gap-x-6 px-5 py-4 text-sm transition hover:bg-slate-900/40 ${
                      focusMode === "forecast" || focusMode === "all" ? "opacity-100" : "opacity-50"
                    }`}
                  >
                    <div className="font-medium text-white">{item.week}</div>
                    <MetricBar value={item.current} max={100} mode="neutral" />
                    <MetricBar value={item.forecast} max={100} mode="forecast" />
                    <DriftBadge value={item.drift} />
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Analytics Focus" className="xl:col-span-5">
            <div className="space-y-3">
              <FocusCard
                title="Forecast Signals"
                value={`${avgForecast}`}
                subtitle="Projected multi-week movement"
                active={focusMode === "forecast"}
                tone="high"
                onClick={() =>
                  setFocusMode((prev) => (prev === "forecast" ? "all" : "forecast"))
                }
              />
              <FocusCard
                title="Supplier Exposure"
                value={`${avgSupplierRisk}`}
                subtitle="Risk + dependency concentration"
                active={focusMode === "suppliers"}
                tone="medium"
                onClick={() =>
                  setFocusMode((prev) => (prev === "suppliers" ? "all" : "suppliers"))
                }
              />
              <FocusCard
                title="Logistics Pressure"
                value={`${avgDelay}h`}
                subtitle="Transport execution strain"
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
                    onClick={() => setFocusMode("all")}
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
          <Panel title="Top Supplier Exposure" className="xl:col-span-6">
            <div className="space-y-3">
              {supplierExposureRows.map((item) => (
                <InsightMetricRow
                  key={item.supplier}
                  label={`Supplier ${item.supplier}`}
                  value={`${item.combined}`}
                  leftValue={item.risk}
                  rightValue={item.dependency}
                  leftLabel="Risk"
                  rightLabel="Dependency"
                  dimmed={focusMode !== "all" && focusMode !== "suppliers"}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Lane Pressure Snapshot" className="xl:col-span-6">
            <div className="space-y-3">
              {logisticsRows.map((item) => (
                <InsightMetricRow
                  key={item.day}
                  label={item.day}
                  value={`${item.pressure}`}
                  leftValue={item.delay}
                  rightValue={item.throughput}
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

function MetricBar({
  value,
  max,
  mode,
}: {
  value: number;
  max: number;
  mode: "forecast" | "neutral";
}) {
  const width = Math.min((value / max) * 100, 100);
  const tone =
    mode === "forecast"
      ? value >= 70
        ? "bg-rose-400"
        : value >= 50
        ? "bg-amber-400"
        : "bg-cyan-400"
      : "bg-slate-300";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="min-w-10 text-right font-medium text-slate-200">
        {value}
      </span>
    </div>
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
