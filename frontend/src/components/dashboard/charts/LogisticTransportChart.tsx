"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type {
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import type { ApiLanePressureItem } from "@/lib/api";
import ChartTooltip from "./ChartTooltip";

type LogisticTransportChartProps = {
  data: ApiLanePressureItem[];
  isLoading?: boolean;
};

const CARD_HEIGHT = 320;
const FOOTER_HEIGHT = 36;

const PRESSURE_COLOR = "#fb7185";
const THROUGHPUT_COLOR = "#22d3ee";

function shortLaneLabel(lane: string) {
  const parts = lane.split("→").map((p) => p.trim());
  if (parts.length !== 2) return lane;

  const shorten = (port: string) =>
    port.replace(" Port", "").split(" ")[0].slice(0, 3).toUpperCase();

  return `${shorten(parts[0])}→${shorten(parts[1])}`;
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
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PRESSURE_COLOR }} />
          <span>Pressure Score</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: THROUGHPUT_COLOR }} />
          <span>Throughput</span>
        </div>
      </div>

      <div className="whitespace-nowrap text-right text-slate-500">Top active lanes</div>
    </div>
  );
}

export default function LogisticTransportChart({
  data,
  isLoading = false,
}: LogisticTransportChartProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        Loading lane pressure...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        No logistics data
      </div>
    );
  }

  const chartData = data.slice(0, 6).map((item) => ({
    lane: item.lane,
    pressure: Number(item.pressure_score.toFixed(1)),
    throughput: Number(item.throughput_pct.toFixed(1)),
    avgDelay: Number(item.avg_delay_hours.toFixed(1)),
    shipmentCount: item.shipment_count,
  }));

  return (
    <div className="flex flex-col" style={{ height: CARD_HEIGHT }}>
      <div className="min-h-0 flex-1" style={{ height: CARD_HEIGHT - FOOTER_HEIGHT - 24 }}>
        <ResponsiveContainer width="100%" height={CARD_HEIGHT - FOOTER_HEIGHT - 24}>
          <BarChart
            data={chartData}
            barGap={6}
            barCategoryGap={12}
            margin={{ top: 0, right: 8, bottom: 0, left: -4 }}
          >
            <CartesianGrid
              stroke="rgba(71,85,105,0.14)"
              vertical={false}
              strokeDasharray="3 6"
            />

            <XAxis
              dataKey="lane"
              interval={0}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              height={42}
              dy={8}
              dx={-8}
              angle={-20}
              tickFormatter={shortLaneLabel}
            />

            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
              domain={[0, 100]}
            />

            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.35)" }}
              content={<ChartTooltip />}
            />

            <Bar
              dataKey="pressure"
              name="pressure"
              fill={PRESSURE_COLOR}
              radius={[10, 10, 0, 0]}
              maxBarSize={40}
            />

            <Bar
              dataKey="throughput"
              name="throughput"
              fill={THROUGHPUT_COLOR}
              radius={[10, 10, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto shrink-0 pt-4" style={{ height: FOOTER_HEIGHT }}>
        <FooterLegend />
      </div>
    </div>
  );
}