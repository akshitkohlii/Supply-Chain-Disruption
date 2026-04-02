"use client";

import { CheckCircle2, Route, Boxes, Sparkles } from "lucide-react";

type Recommendation = {
  id: string;
  alertId: string;
  title: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  impactReduction: number;
  reason: string;
  actions: string[];
  reroutePlan?: {
    from: string;
    to: string;
    etaSavingsHours: number;
  };
  stockPlan?: {
    supplier: string;
    skuGroup: string;
    currentDaysCover: number;
    recommendedDaysCover: number;
    increasePercent: number;
  };
};

type AIMitigationEngineProps = {
  recommendation: Recommendation | null;
  isLoading?: boolean;
  error?: string | null;
  selectedAlertId?: string | null;
};

export default function AIMitigationEngine({
  recommendation,
  isLoading = false,
  error = null,
  selectedAlertId,
}: AIMitigationEngineProps) {
  if (!selectedAlertId) {
    return <EmptyState message="Select an alert to view AI mitigation recommendations." />;
  }

  if (isLoading) {
    return <EmptyState message="Loading mitigation recommendation..." />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!recommendation) {
    return <EmptyState message="No AI recommendations available for this alert." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-4">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">
                {recommendation.title}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <PriorityPill priority={recommendation.priority} />
                <MiniPill value={`${recommendation.confidence}% confidence`} />
                <MiniPill value={`-${recommendation.impactReduction}% risk`} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Why this plan
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {recommendation.reason}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Recommended Actions
          </div>
          <div className="mt-3 space-y-2">
            {recommendation.actions.map((action) => (
              <div key={action} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span className="text-sm text-slate-300">{action}</span>
              </div>
            ))}
          </div>
        </div>

        {recommendation.reroutePlan && (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <Route className="h-3.5 w-3.5 text-cyan-300" />
              Reroute
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <CompactRow label="From" value={recommendation.reroutePlan.from} />
              <CompactRow label="To" value={recommendation.reroutePlan.to} />
              <CompactRow
                label="ETA Saving"
                value={`${recommendation.reroutePlan.etaSavingsHours}h`}
              />
            </div>
          </div>
        )}

        {recommendation.stockPlan && (
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <Boxes className="h-3.5 w-3.5 text-amber-300" />
              Stock Action
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <CompactRow label="Supplier" value={recommendation.stockPlan.supplier} />
              <CompactRow label="SKU Group" value={recommendation.stockPlan.skuGroup} />
              <CompactRow
                label="Current Cover"
                value={`${recommendation.stockPlan.currentDaysCover} days`}
              />
              <CompactRow
                label="Recommended"
                value={`${recommendation.stockPlan.recommendedDaysCover} days`}
              />
              <CompactRow
                label="Increase"
                value={`+${recommendation.stockPlan.increasePercent}%`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-400">
      {message}
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
    <span className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${cls}`}>
      {priority}
    </span>
  );
}

function MiniPill({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300">
      {value}
    </span>
  );
}

function CompactRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}