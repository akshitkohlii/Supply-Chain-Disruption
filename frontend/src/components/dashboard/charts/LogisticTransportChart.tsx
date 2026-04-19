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
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ApiLanePressureItem } from "@/lib/api";
import ChartTooltip from "./ChartTooltip";

type LegacyLanePressureItem = {
  lane?: string;
  pressure_score?: number | string;
  throughput_pct?: number | string;
  avg_delay_hours?: number | string;
  delay_hours?: number | string;
  shipment_count?: number | string;
  origin_port?: string;
  destination_port?: string;
};

type LogisticTransportChartProps = {
  data: ApiLanePressureItem[];
  isLoading?: boolean;
};

const CARD_HEIGHT = 320;
const FOOTER_HEIGHT = 28;
const CHART_HEIGHT = 270;
const X_AXIS_HEIGHT = 50;

const PRESSURE_COLOR = "#fb7185";
const THROUGHPUT_COLOR = "#22d3ee";

function toNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitLane(lane: string) {
  return lane
    .split(/→|->/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatPortLabel(port: string) {
  const normalized = port
    .replace(/^port of\s+/i, "")
    .replace(/\bport\b/gi, "")
    .replace(/\bharbor\b/gi, "")
    .replace(/\bterminal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "Unknown";
  }

  const words = normalized.split(" ").filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  const initials = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  if (initials.length >= 2) {
    return initials.slice(0, 4);
  }

  return normalized.slice(0, 4).toUpperCase();
}

function shortLaneLabel(originPort: string, destinationPort: string) {
  return `${formatPortLabel(originPort)}-${formatPortLabel(destinationPort)}`;
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

  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        No logistics data
      </div>
    );
  }

  const chartData = (data as LegacyLanePressureItem[])
    .slice(0, 6)
    .map((item, index) => {
      const lane = item.lane ?? "Unknown → Unknown";
      const avgDelayRaw =
        item.delay_hours !== undefined ? item.delay_hours : item.avg_delay_hours;

      const avgDelay = toNumber(avgDelayRaw, 0);
      const pressure = toNumber(item.pressure_score, 0);
      const throughput = toNumber(item.throughput_pct, 0);
      const shipmentCount = Math.round(toNumber(item.shipment_count, 0));
      const parts = splitLane(lane);
      const originPort = item.origin_port ?? parts[0] ?? `Unknown ${index + 1}`;
      const destinationPort = item.destination_port ?? parts[1] ?? "Unknown";

      return {
        lane,
        shortLane: shortLaneLabel(originPort, destinationPort),
        pressure: Number(pressure.toFixed(1)),
        throughput: Number(throughput.toFixed(1)),
        avgDelay: Number(avgDelay.toFixed(1)),
        shipmentCount,
        originPort,
        destinationPort,
      };
    })
    .filter((item) => Number.isFinite(item.pressure) && Number.isFinite(item.throughput));

  if (!chartData.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height: CARD_HEIGHT }}
      >
        Logistics data is present, but chart values are invalid.
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: CARD_HEIGHT }}>
      <div className="shrink-0" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            data={chartData}
            margin={{ top: 14, right: 8, bottom: 0, left: -12 }}
            barCategoryGap={18}
          >
            <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />

            <XAxis
              dataKey="shortLane"
              angle={-30}
              textAnchor="end"
              dy={5}
              dx={7}
              interval={0}
              height={X_AXIS_HEIGHT}
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />

            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.04)" }}
              content={
                <ChartTooltip
                  labelPrefix="Lane"
                  formatter={(value, name) => {
                    const numeric = getNumericTooltipValue(value);

                    if (name === "pressure") {
                      return [`${numeric.toFixed(1)}`, "Pressure Score"];
                    }

                    if (name === "throughput") {
                      return [`${numeric.toFixed(1)}%`, "Throughput"];
                    }

                    return [String(value ?? ""), String(name ?? "")];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | {
                          originPort: string;
                          destinationPort: string;
                        }
                      | undefined;

                    if (!row) return "";
                    return `${row.originPort} → ${row.destinationPort}`;
                  }}
                  extraContent={(payload) => {
                    const row = payload?.[0]?.payload as
                      | {
                          avgDelay: number;
                          shipmentCount: number;
                        }
                      | undefined;

                    if (!row) return null;

                    return (
                      <div className="mt-2 space-y-1 border-t border-slate-700/70 pt-2 text-[11px] text-slate-300">
                        <div className="flex items-center justify-between gap-4">
                          <span>Avg Delay</span>
                          <span className="font-medium text-white">
                            {row.avgDelay.toFixed(1)} hrs
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Shipment Count</span>
                          <span className="font-medium text-white">
                            {row.shipmentCount}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />

            <Bar
              dataKey="pressure"
              name="pressure"
              fill={PRESSURE_COLOR}
              radius={[999, 999, 0, 0]}
              barSize={14}
            />
            <Bar
              dataKey="throughput"
              name="throughput"
              fill={THROUGHPUT_COLOR}
              radius={[999, 999, 0, 0]}
              barSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-3"
        style={{ minHeight: FOOTER_HEIGHT }}
      >
        <FooterLegend />
      </div>
    </div>
  );
}
