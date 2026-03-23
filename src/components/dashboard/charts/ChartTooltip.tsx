"use client";

type TooltipEntry = {
  name: string;
  value: number | string;
  color?: string;
  fill?: string;
  stroke?: string;
  payload?: {
    color?: string;
    fill?: string;
    stroke?: string;
  };
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelPrefix?: string;
  seriesColors?: Record<string, string>;
};

function getEntryColor(
  entry: TooltipEntry,
  seriesColors?: Record<string, string>
) {
  return (
    entry.color ||
    entry.stroke ||
    entry.fill ||
    entry.payload?.color ||
    entry.payload?.stroke ||
    entry.payload?.fill ||
    seriesColors?.[entry.name] ||
    "#94a3b8"
  );
}

export default function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix,
  seriesColors,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const title = labelPrefix ? `${labelPrefix} ${label}` : label;

  return (
    <div className="min-w-[120px] rounded-xl border border-slate-700/80 bg-slate-950/96 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      {title ? (
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {title}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getEntryColor(entry, seriesColors) }}
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