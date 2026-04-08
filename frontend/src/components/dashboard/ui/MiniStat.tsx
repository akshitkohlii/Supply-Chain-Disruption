import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type MiniStatProps = {
  label: string;
  value: number;
  trend?: "up" | "down" | "stable";
  tone?: "stable" | "warning" | "critical";
};

function getRiskBarColor(value: number, tone?: MiniStatProps["tone"]) {
  if (tone === "critical") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-400";
  if (tone === "stable") return "bg-cyan-400";

  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-cyan-400";
}

function getTrendColor(tone?: MiniStatProps["tone"]) {
  if (tone === "critical") return "text-rose-400";
  if (tone === "warning") return "text-amber-400";
  if (tone === "stable") return "text-cyan-400";
  return "text-slate-400";
}

export default function MiniStat({
  label,
  value,
  trend = "stable",
  tone,
}: MiniStatProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor = getTrendColor(tone);
  const barColor = getRiskBarColor(value, tone);

  return (
    <div className="flex h-[90px] flex-col rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2">
      <div className="line-clamp-2 min-h-[28px] text-[12px] leading-4 text-white">
        {label}
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[16px] font-semibold text-white">{value}</span>

        <div className={`flex items-center ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-auto pt-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
      </div>
    </div>
  );
}