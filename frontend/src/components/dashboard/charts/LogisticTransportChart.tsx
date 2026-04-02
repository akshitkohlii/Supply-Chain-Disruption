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
import type { ApiLanePressureItem } from "@/lib/api";
import ChartTooltip from "./ChartTooltip";

type LogisticTransportChartProps = {
  data: ApiLanePressureItem[];
  isLoading?: boolean;
};

const CARD_HEIGHT = 320;
const FOOTER_HEIGHT = 32;

const PRESSURE_COLOR = "#fb7185";
const THROUGHPUT_COLOR = "#22d3ee";

const PORT_CODE_MAP: Record<string, string> = {
  "Los Angeles": "LA",
  Shanghai: "SH",
  Mumbai: "MB",
  Busan: "BS",
  Hamburg: "HB",
};

function shortLaneLabel(lane: string) {
  const parts = lane.split(" → ");

  if (parts.length === 2) {
    const from = parts[0].replace(" Port", "").trim();
    const to = parts[1].replace(" Port", "").trim();

    const fromCode = PORT_CODE_MAP[from] ?? from.slice(0, 2).toUpperCase();
    const toCode = PORT_CODE_MAP[to] ?? to.slice(0, 2).toUpperCase();

    return `${fromCode} → ${toCode}`;
  }

  const cleaned = lane.replace(/ Port/g, "").trim();
  return PORT_CODE_MAP[cleaned] ?? cleaned.slice(0, 2).toUpperCase();
}

function FooterLegend() {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: PRESSURE_COLOR }}
          />
          <span>Pressure Score</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: THROUGHPUT_COLOR }}
          />
          <span>Throughput</span>
        </div>
      </div>

      <div className="whitespace-nowrap text-right text-slate-500">
        Top active lanes
      </div>
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
  }));

  return (
    <div className="flex flex-col" style={{ height: CARD_HEIGHT }}>
      <div className="min-h-0 flex-1" style={{ height: CARD_HEIGHT - FOOTER_HEIGHT - 24 }}>
        <ResponsiveContainer width="100%" height={CARD_HEIGHT - FOOTER_HEIGHT - 24}>
          <BarChart
            data={chartData}
            barGap={10}
            barCategoryGap={24}
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
              height={38}
              dy={6}
              dx={-8}
              angle={-25}
              tickFormatter={(value) => shortLaneLabel(String(value))}
            />

            <YAxis
              domain={[0, 100]}
              width={40}
              tick={{ fill: "#94a3b8", fontSize: 11, fillOpacity:0.7 }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(148,163,184,0.05)" }}
            />

            <Bar
              dataKey="pressure"
              name="Pressure Score"
              fill={PRESSURE_COLOR}
              radius={[6, 6, 0, 0]}
              barSize={14}
            />

            <Bar
              dataKey="throughput"
              name="Throughput"
              fill={THROUGHPUT_COLOR}
              radius={[6, 6, 0, 0]}
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-2 shrink-0 pt-3"
        style={{ minHeight: FOOTER_HEIGHT }}
      >
        <FooterLegend />
      </div>
    </div>
  );
}