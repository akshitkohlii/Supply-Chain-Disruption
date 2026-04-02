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
import type { ApiSupplierExposureItem } from "@/lib/api";
import ChartTooltip from "./ChartTooltip";

type SortMode = "risk" | "dependency" | "combined";

type SupplierRiskChartProps = {
  data: ApiSupplierExposureItem[];
  isLoading?: boolean;
};

const RISK_COLOR = "#f43f5e";
const DEPENDENCY_COLOR = "#f59e0b";

const CARD_HEIGHT = 320;
const HEADER_HEIGHT = 30;
const FOOTER_HEIGHT = 42;
const VISIBLE_ROWS = 6;
const ROW_HEIGHT = 34;

const CHART_LEFT = 56;
const CHART_RIGHT = 18;

function getDisplayData(
  data: ApiSupplierExposureItem[],
  sortMode: SortMode,
  showAll: boolean
) {
  const sorted = [...data].sort((a, b) => {
    if (sortMode === "risk") return b.risk_score - a.risk_score;
    if (sortMode === "dependency") return b.dependency_score - a.dependency_score;
    return b.combined_score - a.combined_score;
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
      className={`rounded-xl border px-3 py-2 text-[11px] transition ${
        active
          ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-200"
          : "border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function FixedBottomAxis() {
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div
      className="relative mt-2"
      style={{
        marginLeft: CHART_LEFT,
        marginRight: CHART_RIGHT,
      }}
    >
      <div className="flex justify-between text-[11px] text-slate-500 px-[2px] opacity-80">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

function Footer({ showingCount }: { showingCount: number }) {
  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-[11px] text-slate-400">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: RISK_COLOR }}
          />
          <span>Risk Score</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: DEPENDENCY_COLOR }}
          />
          <span>Dependency</span>
        </div>
      </div>

      <div className="ml-auto whitespace-nowrap text-right text-slate-500">
        Showing top{" "}
        <span className="font-medium text-slate-300">{showingCount}</span>{" "}
        suppliers
      </div>
    </div>
  );
}

export default function SupplierRiskChart({
  data,
  isLoading = false,
}: SupplierRiskChartProps) {
  const [sortMode, setSortMode] = useState<SortMode>("risk");
  const [showAll, setShowAll] = useState(false);

  const chartData = useMemo(() => {
    return getDisplayData(data, sortMode, showAll).map((item) => ({
      supplier: item.supplier_name.replace("Supplier ", "S-"),
      risk: Number(item.risk_score.toFixed(1)),
      dependency: Number(item.dependency_score.toFixed(1)),
    }));
  }, [data, sortMode, showAll]);

  const showingCount = showAll ? data.length : Math.min(VISIBLE_ROWS, data.length);
  const visiblePlotHeight = VISIBLE_ROWS * ROW_HEIGHT;
  const fullPlotHeight = chartData.length * ROW_HEIGHT + 8;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        Loading supplier exposure...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        No supplier exposure data
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: CARD_HEIGHT }}>
      <div
        className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-2 -mt-2"
        style={{ minHeight: HEADER_HEIGHT }}
      >
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

        {data.length > VISIBLE_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {showAll ? `Show Top ${VISIBLE_ROWS}` : `Show All (${data.length})`}
          </button>
        )}
      </div>

      <div className="min-h-0 shrink-0">
        <div
          className="custom-scrollbar overflow-y-auto pr-1"
          style={{
            height: visiblePlotHeight,
            scrollbarGutter: "stable",
          }}
        >
          <ResponsiveContainer
            width="100%"
            height={showAll ? fullPlotHeight : visiblePlotHeight}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              barSize={12}
              barGap={6}
              barCategoryGap={12}
              margin={{ top: 0, right: CHART_RIGHT, bottom: 0, left: 6 }}
            >
              <CartesianGrid
                stroke="rgba(71,85,105,0.14)"
                vertical
                horizontal={false}
              />

              <XAxis type="number" domain={[0, 100]} hide />

              <YAxis
                type="category"
                dataKey="supplier"
                width={CHART_LEFT}
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                content={<ChartTooltip labelPrefix="Supplier" />}
                cursor={{ fill: "rgba(148,163,184,0.04)" }}
              />

              <Bar
                dataKey="risk"
                name="Risk Score"
                fill={RISK_COLOR}
                radius={[0, 999, 999, 0]}
              />

              <Bar
                dataKey="dependency"
                name="Dependency"
                fill={DEPENDENCY_COLOR}
                radius={[0, 999, 999, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 shrink-0">
        <FixedBottomAxis />
      </div>

      <div
        className="shrink-0"
        style={{ minHeight: FOOTER_HEIGHT}}
      >
        <Footer showingCount={showingCount} />
      </div>
    </div>
  );
}