"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import Panel from "@/components/dashboard/Panel";
import { logisticsTransportData } from "@/lib/dashboard-data";

type SortMode = "delay-desc" | "delay-asc" | "throughput-desc" | "throughput-asc";

export default function LogisticsPage() {
  const [sortMode, setSortMode] = useState<SortMode>("delay-desc");
  const [selectedMetric, setSelectedMetric] = useState<"all" | "delay" | "throughput">("all");

  const avgDelay = Math.round(
    logisticsTransportData.reduce((sum, item) => sum + item.delay, 0) /
      logisticsTransportData.length
  );

  const avgThroughput = Math.round(
    logisticsTransportData.reduce((sum, item) => sum + item.throughput, 0) /
      logisticsTransportData.length
  );

  const peakDelayDay = logisticsTransportData.reduce((max, item) =>
    item.delay > max.delay ? item : max
  );

  const processedData = useMemo(() => {
    const data = [...logisticsTransportData];

    switch (sortMode) {
      case "delay-desc":
        data.sort((a, b) => b.delay - a.delay);
        break;
      case "delay-asc":
        data.sort((a, b) => a.delay - b.delay);
        break;
      case "throughput-desc":
        data.sort((a, b) => b.throughput - a.throughput);
        break;
      case "throughput-asc":
        data.sort((a, b) => a.throughput - b.throughput);
        break;
    }

    return data;
  }, [sortMode]);

  const delayDistribution = {
    high: logisticsTransportData.filter((d) => d.delay >= 28).length,
    medium: logisticsTransportData.filter((d) => d.delay >= 20 && d.delay < 28).length,
    low: logisticsTransportData.filter((d) => d.delay < 20).length,
    total: logisticsTransportData.length,
  };

  return (
    <PageShell
      header={
        <PageHeader
          title="Logistics Performance"
          description="Monitor transport delays, throughput efficiency, and lane stability across the logistics network."
        />
      }
    >
      <PageSection>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LogisticsKpiCard
            title="Avg Delay"
            value={`${avgDelay}h`}
            subtitle="Average network delay"
            tone={avgDelay >= 28 ? "high" : avgDelay >= 20 ? "medium" : "low"}
          />
          <LogisticsKpiCard
            title="Avg Throughput"
            value={`${avgThroughput}%`}
            subtitle="Average transport efficiency"
            tone={avgThroughput < 65 ? "high" : avgThroughput < 72 ? "medium" : "low"}
          />
          <LogisticsKpiCard
            title="Peak Delay Day"
            value={peakDelayDay.day}
            subtitle={`${peakDelayDay.delay}h highest delay`}
            tone="high"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Transport Delay & Throughput Table" className="xl:col-span-8">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400/30"
              >
                <option value="delay-desc">Delay: High to Low</option>
                <option value="delay-asc">Delay: Low to High</option>
                <option value="throughput-desc">Throughput: High to Low</option>
                <option value="throughput-asc">Throughput: Low to High</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800/70">
              <div className="grid grid-cols-[0.9fr_1fr_1fr] gap-x-8 bg-slate-950/70 px-5 py-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                <div>Day</div>
                <div>Delay</div>
                <div>Throughput</div>
              </div>

              <div className="divide-y divide-slate-800/70">
                {processedData.map((item) => (
                  <div
                    key={item.day}
                    className="grid grid-cols-[0.9fr_1fr_1fr] items-center gap-x-8 px-5 py-4 text-sm transition hover:bg-slate-900/40"
                  >
                    <div className="font-medium text-white">{item.day}</div>

                    <MetricBar
                      value={item.delay}
                      max={40}
                      suffix="h"
                      mode="delay"
                      dimmed={selectedMetric === "throughput"}
                    />

                    <MetricBar
                      value={item.throughput}
                      max={100}
                      suffix="%"
                      mode="throughput"
                      dimmed={selectedMetric === "delay"}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Delay Distribution" className="xl:col-span-4">
            <div className="space-y-3">
              <DistributionCard
                label="High Delay"
                value={delayDistribution.high}
                percent={Math.round((delayDistribution.high / delayDistribution.total) * 100)}
                tone="high"
                active={selectedMetric === "delay"}
                onClick={() =>
                  setSelectedMetric((prev) => (prev === "delay" ? "all" : "delay"))
                }
              />
              <DistributionCard
                label="Medium Delay"
                value={delayDistribution.medium}
                percent={Math.round((delayDistribution.medium / delayDistribution.total) * 100)}
                tone="medium"
                active={false}
                onClick={() => {}}
              />
              <DistributionCard
                label="Low Delay"
                value={delayDistribution.low}
                percent={Math.round((delayDistribution.low / delayDistribution.total) * 100)}
                tone="low"
                active={selectedMetric === "throughput"}
                onClick={() =>
                  setSelectedMetric((prev) =>
                    prev === "throughput" ? "all" : "throughput"
                  )
                }
              />

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Interaction Mode
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {selectedMetric === "all"
                      ? "Showing all metrics"
                      : selectedMetric === "delay"
                      ? "Delay emphasized"
                      : "Throughput emphasized"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMetric("all")}
                    className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex-1 gap-4">
          <Panel title="Operational Insight" >
            <div className="space-y-4">
              <InsightRow
                label="Highest Delay Window"
                value={`${peakDelayDay.day} (${peakDelayDay.delay}h)`}
              />
              <InsightRow
                label="Best Throughput Day"
                value={`${
                  logisticsTransportData.reduce((max, item) =>
                    item.throughput > max.throughput ? item : max
                  ).day
                } (${
                  logisticsTransportData.reduce((max, item) =>
                    item.throughput > max.throughput ? item : max
                  ).throughput
                }%)`}
              />
              <InsightRow
                label="Network Interpretation"
                value="Delay spikes late in the week while throughput softens, indicating transport capacity strain."
              />
            </div>
          </Panel>
        </div>
      </PageSection>
    </PageShell>
  );
}

function LogisticsKpiCard({
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

function MetricBar({
  value,
  max,
  suffix,
  mode,
  dimmed = false,
}: {
  value: number;
  max: number;
  suffix: string;
  mode: "delay" | "throughput";
  dimmed?: boolean;
}) {
  const width = Math.min((value / max) * 100, 100);

  const tone =
    mode === "delay"
      ? value >= 28
        ? { fill: "bg-rose-400", text: "text-rose-300" }
        : value >= 20
        ? { fill: "bg-amber-400", text: "text-amber-300" }
        : { fill: "bg-cyan-400", text: "text-cyan-300" }
      : value < 65
      ? { fill: "bg-rose-400", text: "text-rose-300" }
      : value < 72
      ? { fill: "bg-amber-400", text: "text-amber-300" }
      : { fill: "bg-cyan-400", text: "text-cyan-300" };

  return (
    <div className={`flex items-center gap-3 ${dimmed ? "opacity-45" : "opacity-100"}`}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${tone.fill}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`min-w-12 text-right font-medium ${tone.text}`}>
        {value}
        {suffix}
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
        <span className="text-slate-500">Share of week</span>
        <span className="text-slate-300">{percent}%</span>
      </div>
    </button>
  );
}

function InsightRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/45 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-200">{value}</div>
    </div>
  );
}
