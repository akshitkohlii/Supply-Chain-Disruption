"use client";

import { TrendingUp, Minus, TrendingDown } from "lucide-react";

type KpiRisk = "low" | "medium" | "high";

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  risk: KpiRisk;
};

function getTrendUi(trend: "up" | "down" | "neutral") {
  if (trend === "up") {
    return {
      text: "text-rose-300",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    };
  }

  if (trend === "down") {
    return {
      text: "text-emerald-300",
      icon: <TrendingDown className="h-3.5 w-3.5" />,
    };
  }

  return {
    text: "text-slate-400",
    icon: <Minus className="h-3.5 w-3.5" />,
  };
}

function getRiskUi(risk: KpiRisk) {
  if (risk === "high") {
    return {
      accent: "bg-rose-400",
      text: "text-rose-300",
      tint: "from-rose-500/10 via-rose-500/4 to-transparent",
    };
  }

  if (risk === "medium") {
    return {
      accent: "bg-amber-400",
      text: "text-amber-300",
      tint: "from-amber-400/10 via-amber-400/4 to-transparent",
    };
  }

  return {
    accent: "bg-cyan-400",
    text: "text-cyan-300",
    tint: "from-cyan-400/10 via-cyan-400/4 to-transparent",
  };
}

export default function KpiCard({
  title,
  value,
  change,
  trend,
  risk,
}: KpiCardProps) {
  const trendUi = getTrendUi(trend);
  const riskUi = getRiskUi(risk);

  return (
      <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-slate-700 hover:bg-slate-950/80">
  <div className={`absolute inset-y-0 left-0 w-1 ${riskUi.accent}`} />

  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)_45%)]" />
  <div className={`pointer-events-none absolute inset-0 bg-linear-to-r ${riskUi.tint}`} />

  <div className="relative pl-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[10px] uppercase tracking-[0.22em] text-slate-500">
            {title}
          </p>
          <span className={`text-[10px] uppercase tracking-[0.16em] ${riskUi.text}`}>
            {risk}
          </span>
        </div>

        <div className="mt-2 flex items-end gap-2">
          <h3 className="text-xl md:text-2xl font-semibold leading-none text-white">
            {value}
          </h3>

          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${trendUi.text}`}
          >
            {trendUi.icon}
            {change}
          </span>
        </div>
      </div>
    </div>

    <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-slate-800/80">
      <div
        className={`h-full rounded-full ${
          risk === "high"
            ? "w-[78%] bg-rose-400/80"
            : risk === "medium"
            ? "w-[58%] bg-amber-400/80"
            : "w-[38%] bg-cyan-400/80"
        }`}
      />
    </div>
  </div>
</div>
  );
}