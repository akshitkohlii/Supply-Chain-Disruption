
"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { predictiveRiskData } from "@/lib/dashboard-data";
import ChartTooltip from "./ChartTooltip";

const CURRENT_RISK_COLOR = "#38bdf8";
const FORECAST_RISK_COLOR = "#a78bfa";

export default function PredictiveRiskChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="h-full min-h-0 w-full min-w-0 pt-2">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={predictiveRiskData}
          margin={{ top: 6, right: 4, bottom: 0, left: -30 }}
          onMouseMove={(state) => {
            if (typeof state?.activeTooltipIndex === "number") {
              setActiveIndex(state.activeTooltipIndex);
            }
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="currentRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CURRENT_RISK_COLOR} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CURRENT_RISK_COLOR} stopOpacity={0.02} />
            </linearGradient>

            <linearGradient id="forecastRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={FORECAST_RISK_COLOR} stopOpacity={0.35} />
              <stop offset="95%" stopColor={FORECAST_RISK_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(71,85,105,0.18)" vertical={false} />

          <XAxis
            dataKey="week"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />

          <YAxis
            width={60}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke: "rgba(148,163,184,0.35)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          <Legend wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }} />

          <Area
            type="monotone"
            dataKey="current"
            name="Current Risk"
            stroke={CURRENT_RISK_COLOR}
            fill="url(#currentRisk)"
            strokeWidth={2.5}
            strokeOpacity={activeIndex === null ? 1 : 0.3}
            fillOpacity={activeIndex === null ? 1 : 0.22}
          />

          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast Risk"
            stroke={FORECAST_RISK_COLOR}
            fill="url(#forecastRisk)"
            strokeWidth={2.5}
            strokeOpacity={activeIndex === null ? 1 : 0.3}
            fillOpacity={activeIndex === null ? 1 : 0.22}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

