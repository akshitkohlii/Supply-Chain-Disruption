"use client";

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  series: number[];
};

function Sparkline({
  series,
  trend,
}: {
  series: number[];
  trend: "up" | "down" | "neutral";
}) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;

  const strokeClass =
    trend === "up"
      ? "stroke-rose-400"
      : trend === "down"
      ? "stroke-emerald-400"
      : "stroke-cyan-400";

  const fillClass =
    trend === "up"
      ? "fill-rose-500/10"
      : trend === "down"
      ? "fill-emerald-500/10"
      : "fill-cyan-500/10";

  const points = series
    .map((value, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <div className="mt-3 h-12 w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <polygon points={areaPoints} className={fillClass} />
        <polyline
          points={points}
          fill="none"
          className={`${strokeClass}`}
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function KpiCard({
  title,
  value,
  change,
  trend,
  series,
}: KpiCardProps) {
  const trendColor =
    trend === "up"
      ? "text-rose-400"
      : trend === "down"
      ? "text-emerald-400"
      : "text-cyan-400";

  const glowClass =
    trend === "up"
      ? "from-rose-500/15 via-orange-500/5 to-transparent"
      : trend === "down"
      ? "from-emerald-500/15 via-cyan-500/5 to-transparent"
      : "from-cyan-500/15 via-blue-500/5 to-transparent";

  const dotClass =
    trend === "up"
      ? "bg-rose-400"
      : trend === "down"
      ? "bg-emerald-400"
      : "bg-cyan-400";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-[0_0_0_1px_rgba(51,65,85,0.35),0_10px_30px_rgba(2,6,23,0.45)]">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glowClass} opacity-70`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {title}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <h3 className="text-xl font-semibold leading-none text-white md:text-2xl">
                {value}
              </h3>
              <span className={`text-xs font-medium ${trendColor}`}>
                {change}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-2 py-1">
            <span className={`h-2 w-2 rounded-full ${dotClass} animate-pulse`} />
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Live
            </span>
          </div>
        </div>

        <Sparkline series={series} trend={trend} />

        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
          <span>Last 8 intervals</span>
          <span className="text-slate-400 group-hover:text-slate-300">
            Terminal feed
          </span>
        </div>
      </div>
    </div>
  );
}