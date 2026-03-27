
"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supplierRiskData } from "@/lib/dashboard-data";
import ChartTooltip from "./ChartTooltip";

type SortMode = "risk" | "dependency" | "combined";

const RISK_COLOR = "#e11d48";
const DEPENDENCY_COLOR = "#f59e0b";

const VISIBLE_ROWS = 6;
const ROW_HEIGHT = 34;
const BAR_SIZE = 10;
const BAR_GAP = 2;
const BAR_CATEGORY_GAP = 12;
const VIEWPORT_HEIGHT = VISIBLE_ROWS * ROW_HEIGHT + 24;

function getDisplayData(
  data: typeof supplierRiskData,
  sortMode: SortMode,
  showAll: boolean
) {
  const sorted = [...data].sort((a, b) => {
    if (sortMode === "risk") return b.risk - a.risk;
    if (sortMode === "dependency") return b.dependency - a.dependency;
    return b.risk + b.dependency - (a.risk + a.dependency);
  });

  return showAll ? sorted : sorted.slice(0, VISIBLE_ROWS);
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[11px] transition ${
        active
          ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-200"
          : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function FooterLegend() {
  return (
    <div className="flex items-center gap-5 text-[11px] text-slate-400">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: RISK_COLOR }}
        />
        <span>Risk Score</span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: DEPENDENCY_COLOR }}
        />
        <span>Dependency</span>
      </div>
    </div>
  );
}

function FooterAxis() {
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="pl-14.5 pr-3">
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-2 border-t border-slate-800/70" />
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute top-0 -translate-x-1/2 text-[11px] text-slate-500"
            style={{ left: `${tick}%` }}
          >
            <div className="mx-auto mb-1 h-2 w-px bg-slate-700/80" />
            <span>{tick}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplierRiskChart() {
  const [sortMode, setSortMode] = useState<SortMode>("risk");
  const [showAll, setShowAll] = useState(false);

  const chartData = useMemo(() => {
    return getDisplayData(supplierRiskData, sortMode, showAll);
  }, [sortMode, showAll]);

  const fullChartHeight = chartData.length * ROW_HEIGHT + 22;

  const seriesColors = {
    "Risk Score": RISK_COLOR,
    Dependency: DEPENDENCY_COLOR,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ToggleButton
            active={sortMode === "risk"}
            onClick={() => setSortMode("risk")}
          >
            Top Risk
          </ToggleButton>

          <ToggleButton
            active={sortMode === "dependency"}
            onClick={() => setSortMode("dependency")}
          >
            Top Dependency
          </ToggleButton>

          <ToggleButton
            active={sortMode === "combined"}
            onClick={() => setSortMode("combined")}
          >
            Combined
          </ToggleButton>
        </div>

        {supplierRiskData.length > VISIBLE_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {showAll
              ? `Show Top ${VISIBLE_ROWS}`
              : `Show All (${supplierRiskData.length})`}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <div
          className="custom-scrollbar overflow-y-scroll pr-1"
          style={{
            height: VIEWPORT_HEIGHT,
            scrollbarGutter: "stable",
          }}
        >
          <ResponsiveContainer
            width="100%"
            height={showAll ? fullChartHeight : VIEWPORT_HEIGHT}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              barSize={BAR_SIZE}
              barGap={BAR_GAP}
              barCategoryGap={BAR_CATEGORY_GAP}
              margin={{ top: 6, right: 12, bottom: 16, left: 6 }}
            >
              <CartesianGrid
                stroke="rgba(71,85,105,0.18)"
                vertical
                horizontal={false}
              />

              <XAxis type="number" domain={[0, 100]} hide />

              <YAxis
                type="category"
                dataKey="supplier"
                width={52}
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                content={
                  <ChartTooltip
                    labelPrefix="Supplier"
                    seriesColors={seriesColors}
                  />
                }
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
                offset={12}
              />

              <Bar
                dataKey="risk"
                name="Risk Score"
                fill={RISK_COLOR}
                radius={[0, 999, 999, 0]}
                isAnimationActive
                animationDuration={350}
              />

              <Bar
                dataKey="dependency"
                name="Dependency"
                fill={DEPENDENCY_COLOR}
                radius={[0, 999, 999, 0]}
                isAnimationActive
                animationDuration={350}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 shrink-0 pt-3">
        <FooterAxis />

        <div className="mt-2 flex items-center justify-between gap-3">
          <FooterLegend />

          <div className="text-[11px] text-slate-500">
            {showAll
              ? `Showing all ${supplierRiskData.length} suppliers`
              : `Showing top ${VISIBLE_ROWS} of ${supplierRiskData.length} suppliers`}
          </div>
        </div>
      </div>
    </div>
  );
}
