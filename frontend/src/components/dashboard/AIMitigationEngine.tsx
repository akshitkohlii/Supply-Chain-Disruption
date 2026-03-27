
"use client";

import type { MitigationRecommendation } from "@/lib/dashboard-data";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Route,
  Boxes,
} from "lucide-react";

type AIMitigationEngineProps = {
  recommendations: MitigationRecommendation[];
  selectedRecommendationId: string | null;
  onSimulate: (recommendation: MitigationRecommendation) => void;
};

export default function AIMitigationEngine({
  recommendations,
  selectedRecommendationId,
  onSimulate,
}: AIMitigationEngineProps) {
  if (recommendations.length === 0) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-5 text-sm text-slate-400">
      No AI recommendations available for this alert.
    </div>
  );
}

  return (
    <div className="space-y-3">
      {recommendations.map((item) => {
        const isActive = item.id === selectedRecommendationId;

        return (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 transition-all duration-200 ${
              isActive
                ? "border-cyan-400/30 bg-cyan-500/5"
                : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriorityPill priority={item.priority} />
                  <StatPill label="Confidence" value={`${item.confidence}%`} />
                  <StatPill
                    label="Risk Reduction"
                    value={`-${item.impactReduction}%`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSimulate(item)}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  isActive
                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                    : "border-slate-800/80 bg-slate-950/70 text-slate-300 hover:border-cyan-400/30 hover:text-white"
                }`}
              >
                {isActive ? "Simulating" : "Simulate"}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {item.actions.map((action) => (
                <div
                  key={action}
                  className="flex items-start gap-2 rounded-xl bg-slate-950/55 px-3 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span className="text-sm text-slate-300">{action}</span>
                </div>
              ))}
            </div>

            {item.reason && (
              <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Why this recommendation
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.reason}</p>
              </div>
            )}

            {item.reroutePlan && (
              <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <Route className="h-3.5 w-3.5 text-cyan-300" />
                  Reroute Plan
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-300">
                  <InfoRow label="From" value={item.reroutePlan.from} />
                  <InfoRow label="To" value={item.reroutePlan.to} />
                  <InfoRow
                    label="Shipments"
                    value={item.reroutePlan.shipmentIds.join(", ")}
                  />
                  <InfoRow
                    label="ETA Saving"
                    value={`${item.reroutePlan.etaSavingsHours}h`}
                  />
                </div>
              </div>
            )}

            {item.stockPlan && (
              <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <Boxes className="h-3.5 w-3.5 text-amber-300" />
                  Stock Action
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-300">
                  <InfoRow label="Supplier" value={item.stockPlan.supplier} />
                  <InfoRow label="SKU Group" value={item.stockPlan.skuGroup} />
                  <InfoRow
                    label="Current Cover"
                    value={`${item.stockPlan.currentDaysCover} days`}
                  />
                  <InfoRow
                    label="Recommended Cover"
                    value={`${item.stockPlan.recommendedDaysCover} days`}
                  />
                  <InfoRow
                    label="Increase"
                    value={`+${item.stockPlan.increasePercent}%`}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                Recommended by mitigation engine
              </div>

              <button
                type="button"
                onClick={() => onSimulate(item)}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
              >
                Compare Impact
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriorityPill({
  priority,
}: {
  priority: "high" | "medium" | "low";
}) {
  const cls =
    priority === "high"
      ? "bg-rose-500/10 text-rose-300 border-rose-400/20"
      : priority === "medium"
      ? "bg-amber-500/10 text-amber-300 border-amber-400/20"
      : "bg-cyan-500/10 text-cyan-300 border-cyan-400/20";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${cls}`}
    >
      {priority} priority
    </span>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300">
      {label}: {value}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-900/40 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}
