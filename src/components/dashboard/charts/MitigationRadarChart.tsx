
"use client";

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";

type MitigationRadarDatum = {
  scenario: string;
  risk: number;
  delay: number;
  recovery: number;
  cost: number;
};

type MitigationRadarChartProps = {
  data: MitigationRadarDatum[];
};

function shortenScenarioLabel(label: string) {
  if (label === "No Action") return "No Action";
  if (label === "Reroute via Alternate Port") return "Reroute";
  if (label === "Reroute + Buffer Stock") return "Reroute + Stock";
  if (label === "Increase Safety Stock") return "Stock";
  if (label === "Stock + Alternate Supplier") return "Stock + Alt";
  if (label === "Activate Alternate Carrier") return "Alt Carrier";
  if (label === "Carrier + Priority Allocation") return "Carrier + Priority";

  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
}

type RadarTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  label?: string;
};

function RadarTooltip({ active, payload, label }: RadarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-30 rounded-xl border border-slate-700/80 bg-slate-950/96 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>

      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color ?? "#94a3b8" }}
              />
              <span className="truncate text-[11px] text-slate-300">
                {entry.name}
              </span>
            </div>

            <span className="shrink-0 text-[11px] font-semibold text-white">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MitigationRadarChart({
  data,
}: MitigationRadarChartProps) {
  return (
    <div className="h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          outerRadius="62%"
          cx="50%"
          cy="52%"
          margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
        >
          <PolarGrid stroke="rgba(71,85,105,0.22)" />

          <PolarAngleAxis
            dataKey="scenario"
            tick={({ payload, x, y, textAnchor }) => (
              <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                fontSize={11}
                fill="#94a3b8"
              >
                {shortenScenarioLabel(payload.value)}
              </text>
            )}
          />

          <PolarRadiusAxis tick={false} axisLine={false} />

          <Tooltip content={<RadarTooltip />} cursor={false} />

          <Radar
            name="Risk"
            dataKey="risk"
            stroke="#fb7185"
            fill="#fb7185"
            fillOpacity={0.12}
            strokeWidth={2}
          />
          <Radar
            name="Delay"
            dataKey="delay"
            stroke="#fbbf24"
            fill="#fbbf24"
            fillOpacity={0.1}
            strokeWidth={2}
          />
          <Radar
            name="Recovery"
            dataKey="recovery"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.1}
            strokeWidth={2}
          />
          <Radar
            name="Cost"
            dataKey="cost"
            stroke="#a78bfa"
            fill="#a78bfa"
            fillOpacity={0.08}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
