"use client";

import type { ReactNode } from "react";

type TooltipEntry = {
  name?: string;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelPrefix?: string;
  formatter?: (
    value: TooltipEntry["value"],
    name: TooltipEntry["name"],
    entry: TooltipEntry
  ) => [ReactNode, ReactNode] | ReactNode;
  labelFormatter?: (
    label: string | undefined,
    payload?: TooltipEntry[]
  ) => ReactNode;
  extraContent?: (payload?: TooltipEntry[]) => ReactNode;
};

function getNumericValue(value: TooltipEntry["value"]) {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0);
  }
  return Number(value ?? 0);
}

function formatValue(
  dataKey: string | undefined,
  value: TooltipEntry["value"]
) {
  const numericValue = getNumericValue(value);

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
  formatter,
  labelFormatter,
  extraContent,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const resolvedLabel = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div className="min-w-[180px] rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-3 shadow-2xl backdrop-blur">
      {resolvedLabel ? (
        <div className="mb-2 border-b border-slate-800 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          {labelPrefix ? `${labelPrefix}: ` : ""}
          {resolvedLabel}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const customFormatted = formatter?.(entry.value, entry.name, entry);

          let valueNode: ReactNode;
          let labelNode: ReactNode;

          if (Array.isArray(customFormatted)) {
            valueNode = customFormatted[0];
            labelNode = customFormatted[1];
          } else if (customFormatted !== undefined) {
            valueNode = customFormatted;
            labelNode = formatLabel(entry.name, entry.dataKey);
          } else {
            valueNode = formatValue(entry.dataKey, entry.value);
            labelNode = formatLabel(entry.name, entry.dataKey);
          }

          return (
            <div
              key={`${entry.dataKey ?? entry.name ?? "item"}-${index}`}
              className="flex items-center justify-between gap-4 text-[12px]"
            >
              <div className="flex items-center gap-2 text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? "#94a3b8" }}
                />
                <span>{labelNode}</span>
              </div>

              <span className="font-medium text-white">{valueNode}</span>
            </div>
          );
        })}
      </div>

      {extraContent ? extraContent(payload) : null}
    </div>
  );
}