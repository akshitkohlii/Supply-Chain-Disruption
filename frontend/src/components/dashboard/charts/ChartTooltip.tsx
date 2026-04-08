"use client";

type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelPrefix?: string;
};

function formatValue(dataKey: string | undefined, value: number | string | undefined) {
  const numericValue = Number(value ?? 0);

  if (dataKey === "throughput") return `${numericValue.toFixed(1)}%`;
  if (dataKey === "avgDelay") return `${numericValue.toFixed(1)}h`;
  if (dataKey === "pressure") return `${numericValue.toFixed(1)}`;
  if (dataKey === "current") return `${numericValue.toFixed(1)}`;
  if (dataKey === "forecast") return `${numericValue.toFixed(1)}`;
  if (dataKey === "drift") return `${numericValue.toFixed(1)}`;
  if (dataKey === "risk") return `${numericValue.toFixed(1)}`;
  if (dataKey === "dependency") return `${numericValue.toFixed(1)}`;
  if (dataKey === "combined") return `${numericValue.toFixed(1)}`;
  if (dataKey === "shipmentCount") return `${numericValue.toFixed(0)}`;

  return `${numericValue.toFixed(1)}`;
}

function formatLabel(name: string | undefined, dataKey: string | undefined) {
  if (dataKey === "current") return "Current Risk";
  if (dataKey === "forecast") return "Forecast Risk";
  if (dataKey === "drift") return "Drift";
  if (dataKey === "pressure") return "Pressure Score";
  if (dataKey === "throughput") return "Throughput";
  if (dataKey === "avgDelay") return "Avg Delay";
  if (dataKey === "shipmentCount") return "Shipment Count";
  if (dataKey === "risk") return "Risk Score";
  if (dataKey === "dependency") return "Dependency Score";
  if (dataKey === "combined") return "Combined Score";

  return name ?? dataKey ?? "Value";
}

export default function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[180px] rounded-xl border border-slate-800/80 bg-slate-950/95 px-3 py-2 shadow-xl">
      {label ? (
        <div className="mb-2 text-xs font-medium text-white">
          {labelPrefix ? `${labelPrefix}: ${label}` : label}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey ?? entry.name ?? "row"}-${index}`}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#94a3b8" }}
              />
              <span>{formatLabel(entry.name, entry.dataKey)}</span>
            </div>

            <span className="font-medium text-white">
              {formatValue(entry.dataKey, entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}