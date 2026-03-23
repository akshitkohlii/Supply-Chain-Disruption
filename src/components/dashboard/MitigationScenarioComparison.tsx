"use client";

import type { MitigationRecommendation } from "@/lib/dashboard-data";
import MitigationRadarChart from "./charts/MitigationRadarChart";

type MitigationScenarioComparisonProps = {
  recommendation: MitigationRecommendation | null;
};

export default function MitigationScenarioComparison({
  recommendation,
}: MitigationScenarioComparisonProps) {
  if (!recommendation) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-5 text-sm text-slate-400">
        Select <span className="text-slate-200">Simulate</span> on a recommendation to compare outcomes.
      </div>
    );
  }

  const baseline = recommendation.scenarios[0];

  const bestScenario = recommendation.scenarios.reduce((best, current) => {
    const bestScore =
      best.riskScore + best.delayHours + best.recoveryDays * 10 + best.costImpact;
    const currentScore =
      current.riskScore +
      current.delayHours +
      current.recoveryDays * 10 +
      current.costImpact;
    return currentScore < bestScore ? current : best;
  });

  const radarData = recommendation.scenarios.map((scenario) => ({
    scenario: scenario.label,
    risk: scenario.riskScore,
    delay: Math.min(100, scenario.delayHours * 4),
    recovery: Math.min(100, scenario.recoveryDays * 20),
    cost: Math.min(100, scenario.costImpact * 8),
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Confidence" value={`${recommendation.confidence}%`} />
        <MetricCard label="Risk Reduction" value={`-${recommendation.impactReduction}%`} />
        <MetricCard label="Baseline Risk" value={`${baseline.riskScore}`} />
        <MetricCard label="Best Option" value={bestScenario.label} compact />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1.22fr_0.78fr]">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-white">Outcome Comparison</h3>
            <p className="text-xs text-slate-400">
              Lower values are better across risk, delay, recovery, and cost.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800/70">
            <div className="grid grid-cols-[1.7fr_0.9fr_0.95fr_1.05fr_0.8fr] gap-x-4 bg-slate-950/70 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
  <div>Scenario</div>
  <div>Risk</div>
  <div>Delay</div>
  <div>Recovery</div>
  <div>Cost</div>
</div>

            <div className="divide-y divide-slate-800/70">
              {recommendation.scenarios.map((scenario) => {
                const isBaseline = scenario.id === baseline.id;
                const isBest = scenario.id === bestScenario.id;

                return (
                  <div
  key={scenario.id}
  className={`grid grid-cols-[1.7fr_0.9fr_0.95fr_1.05fr_0.8fr] items-center gap-x-4 px-3 py-3 text-sm ${
    isBest
      ? "bg-emerald-500/8"
      : isBaseline
      ? "bg-slate-950/60"
      : "bg-slate-900/40"
  }`}
>
                    <div className="pr-3">
                      <div className="font-medium text-white">{scenario.label}</div>
                      <div className="mt-1 flex gap-2">
                        {isBaseline && (
                          <span className="rounded-full border border-slate-700/80 bg-slate-950/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                            Baseline
                          </span>
                        )}
                        {isBest && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                            Best
                          </span>
                        )}
                      </div>
                    </div>

                    <CellValue value={`${scenario.riskScore}`} />
                    <CellValue value={`${scenario.delayHours}h`} />
                    <CellValue value={`${scenario.recoveryDays}d`} />
                    <CellValue value={`+${scenario.costImpact}%`} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/55 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Decision Insight
            </div>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-medium text-white">{bestScenario.label}</span> offers the strongest
              trade-off for this recommendation by reducing disruption risk while keeping recovery time controlled.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-white">Trade-off Radar</h3>
            <p className="text-xs text-slate-400">
              Normalized view of scenario trade-offs.
            </p>
          </div>

          <MitigationRadarChart data={radarData} />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Selected Strategy" value={recommendation.title} compact />
            <MiniStat label="Compared Scenarios" value={`${recommendation.scenarios.length}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/55 p-2.5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-semibold text-white ${compact ? "text-sm" : "text-lg"}`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/55 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>
        {value}
      </div>
    </div>
  );
}

function CellValue({ value }: { value: string }) {
  return <div className="text-sm font-medium text-slate-200">{value}</div>;
}