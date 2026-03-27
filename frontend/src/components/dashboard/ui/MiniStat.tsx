
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type MiniStatProps = {
  label: string;
  value: number;
  trend: "up" | "down" | "stable";
};

function getRiskBarColor(value: number) {
  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function MiniStat({ label, value, trend }: MiniStatProps) {
  const trendColor =
    trend === "up"
      ? "text-rose-400"
      : trend === "down"
      ? "text-emerald-400"
      : "text-slate-400";

  const TrendIcon =
    trend === "up"
      ? TrendingUp
      : trend === "down"
      ? TrendingDown
      : Minus;

  const barColor = getRiskBarColor(value);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
      <div className="text-xs text-slate-400">{label}</div>

      <div className="mt-2 flex items-end justify-between">
        <span className="text-lg font-semibold text-white">{value}</span>

        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded bg-slate-800">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
