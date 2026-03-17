import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type MiniStatProps = {
  label: string;
  value: number;
  trend: "up" | "down" | "stable";
};

export default function MiniStat({ label, value, trend }: MiniStatProps) {
  const trendColor =
    trend === "up"
      ? "text-rose-400"
      : trend === "down"
      ? "text-emerald-400"
      : "text-cyan-400";

  const TrendIcon =
    trend === "up"
      ? TrendingUp
      : trend === "down"
      ? TrendingDown
      : Minus;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3">
      <div className="text-xs text-slate-400">{label}</div>

      <div className="mt-2 flex items-end justify-between">
        <span className="text-lg font-semibold text-white">
          {value}
        </span>

        {/* ICON instead of text */}
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-cyan-400 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}