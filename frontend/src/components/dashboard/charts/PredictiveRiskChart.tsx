"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import type { ApiAnalyticsOverview, ApiForecastPoint } from "@/lib/api";
import ChartTooltip from "./ChartTooltip";

type PredictiveRiskChartProps = {
  data: ApiForecastPoint[];
  overview: ApiAnalyticsOverview | null;
  isLoading?: boolean;
};

const CARD_HEIGHT = 320;
const FOOTER_HEIGHT = 28;
const CHART_HEIGHT = 236;

const DAY_MAP: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

function getDomain(values: number[]) {
  if (!values.length) return [0, 100];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1.5, (max - min) * 0.35);

  const lower = Math.max(0, Math.floor((min - pad) / 2) * 2);
  const upper = Math.min(100, Math.ceil((max + pad) / 2) * 2);

  return [lower, upper];
}

function getNumericTooltipValue(value: ValueType | undefined) {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0);
  }
  return Number(value ?? 0);
}

function FooterLegend() {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-400" />
          <span>Current Risk</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-violet-400" />
          <span>Forecast Risk</span>
        </div>
      </div>

      <div className="whitespace-nowrap text-right text-slate-500">7-day trend</div>
    </div>
  );
}

export default function PredictiveRiskChart({
  data,
  overview,
  isLoading = false,
}: PredictiveRiskChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      day: DAY_MAP[item.day] ?? item.day.slice(0, 3).toUpperCase(),
      current: Number(item.current.toFixed(1)),
      forecast: Number(item.forecast.toFixed(1)),
      drift: Number(item.drift.toFixed(1)),
    }));
  }, [data]);

  const yDomain = useMemo(() => {
    const values = chartData.flatMap((item) => [item.current, item.forecast]);
    return getDomain(values);
  }, [chartData]);

  const avgCurrent = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((sum, item) => sum + item.current, 0) / chartData.length;
  }, [chartData]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        Loading forecast...
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        No forecast data
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: CARD_HEIGHT }}>
      <div className="mb-2 shrink-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Forecast Snapshot
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
          <span>
            Avg forecast risk:{" "}
            <span className="font-medium text-white">
              {overview ? overview.avg_forecast_risk.toFixed(1) : "0.0"}
            </span>
          </span>
          <span className="hidden text-slate-600 sm:inline">•</span>
          <span>
            Drift:{" "}
            <span className="font-medium text-white">
              {overview ? overview.forecast_drift.toFixed(2) : "0.00"}
            </span>
          </span>
        </div>
      </div>

      <div className="shrink-0" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart
            data={chartData}
            margin={{ top: 0, right: 8, bottom: 8, left: -12 }}
            onMouseMove={(state) => {
              if (typeof state?.activeTooltipIndex === "number") {
                setActiveIndex(state.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id="predictiveCurrentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="predictiveForecastFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="rgba(71,85,105,0.14)"
              strokeDasharray="3 6"
            />

            <XAxis
              dataKey="day"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />

            <YAxis
              domain={yDomain}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />

            <Tooltip content={<ChartTooltip />} cursor={false} />

            <ReferenceLine
              y={Number(avgCurrent.toFixed(1))}
              stroke="rgba(148,163,184,0.22)"
              strokeDasharray="6 6"
            />

            <Area
              type="monotone"
              dataKey="current"
              stroke="#38bdf8"
              strokeWidth={2.4}
              fill="url(#predictiveCurrentFill)"
              activeDot={{ r: 4 }}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (typeof cx !== "number" || typeof cy !== "number") return null;
                const isActive = activeIndex === index;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 4.5 : 3}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={isActive ? 3 : 2}
                  />
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#a78bfa"
              strokeWidth={2.4}
              fill="url(#predictiveForecastFill)"
              activeDot={{ r: 4 }}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (typeof cx !== "number" || typeof cy !== "number") return null;
                const isActive = activeIndex === index;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 4.5 : 3}
                    fill="#0f172a"
                    stroke="#a78bfa"
                    strokeWidth={isActive ? 3 : 2}
                  />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto shrink-0 pt-2" style={{ height: FOOTER_HEIGHT }}>
        <FooterLegend />
      </div>
    </div>
  );
}