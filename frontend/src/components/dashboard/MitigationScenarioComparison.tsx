"use client";

import MitigationRadarChart from "./charts/MitigationRadarChart";

type Scenario = {
  id: string;
  label: string;
  riskScore: number;
  delayHours: number;
  recoveryDays: number;
  costImpact: number;
};

type Recommendation = {
  id: string;
  alertId: string;
  title: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  impactReduction: number;
  reason: string;
  actions: string[];
  scenarios: Scenario[];
};

type MitigationScenarioComparisonProps = {
  recommendation: Recommendation | null;
  scenarios: Scenario[];
  isLoading?: boolean;
  error?: string | null;
  selectedAlertId?: string | null;
};

function formatCurrencyCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function rankScenario(scenario: Scenario) {
  return (
    scenario.riskScore * 8 +
    scenario.delayHours * 2 +
    scenario.recoveryDays * 12 +
    scenario.costImpact / 1000
  );
}

export default function MitigationScenarioComparison({
  recommendation,
  scenarios,
  isLoading = false,
  error = null,
  selectedAlertId,
}: MitigationScenarioComparisonProps) {
  if (!selectedAlertId) {
    return <EmptyState message="Select an alert to compare mitigation scenarios." />;
  }

  if (isLoading) {
    return <EmptyState message="Loading mitigation scenarios..." />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!recommendation || scenarios.length === 0) {
    return <EmptyState message="No simulation scenarios available for this alert." />;
  }

  const baseline = scenarios[0];

  const bestScenario = scenarios.reduce((best, current) => {
    return rankScenario(current) < rankScenario(best) ? current : best;
  });

  const radarData = scenarios.map((scenario) => ({
    scenario: scenario.label,
    risk: Math.min(100, scenario.riskScore),
    delay: Math.min(100, scenario.delayHours * 4),
    recovery: Math.min(100, scenario.recoveryDays * 20),
    cost: Math.min(100, scenario.costImpact / 250),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Confidence" value={`${(recommendation.confidence)*100}%`} />
        <MetricCard label="Risk Reduction" value={`-${recommendation.impactReduction}%`} />
        <MetricCard label="Baseline Risk" value={`${baseline.riskScore}`} />
        <MetricCard label="Best Option" value={bestScenario.label} compact />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="shrink-0">
            <h3 className="text-sm font-medium text-white">Outcome Comparison</h3>
            <p className="text-xs text-slate-400">
              Lower values are better across risk, delay, recovery, and cost.
            </p>
          </div>

          <div className="mt-4 min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800/70">
            <div className="grid shrink-0 grid-cols-[1.8fr_0.85fr_0.9fr_1fr_0.9fr] gap-x-3 bg-slate-950/70 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <div>Scenario</div>
              <div>Risk</div>
              <div>Delay</div>
              <div>Recovery</div>
              <div>Cost</div>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-800/70 overflow-y-auto">
              {scenarios.map((scenario) => {
                const isBaseline = scenario.id === baseline.id;
                const isBest = scenario.id === bestScenario.id;

                return (
                  <div
                    key={scenario.id}
                    className={`grid grid-cols-[1.8fr_0.85fr_0.9fr_1fr_0.9fr] items-center gap-x-3 px-4 py-4 text-sm ${
                      isBest
                        ? "bg-emerald-500/8"
                        : isBaseline
                          ? "bg-slate-950/60"
                          : "bg-slate-900/35"
                    }`}
                  >
                    <div className="pr-3">
                      <div className="font-medium text-white">{scenario.label}</div>
                      <div className="mt-2 flex gap-2">
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
                    <CellValue value={formatCurrencyCompact(scenario.costImpact)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 shrink-0 rounded-2xl border border-slate-800/70 bg-slate-950/55 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Decision Insight
            </div>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-medium text-white">{bestScenario.label}</span>{" "}
              offers the strongest trade-off by reducing disruption risk while keeping
              recovery time controlled.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
          <div className="shrink-0">
            <h3 className="text-sm font-medium text-white">Trade-off Radar</h3>
            <p className="text-xs text-slate-400">
              Normalized view of scenario trade-offs.
            </p>
          </div>

          <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden">
            <MitigationRadarChart data={radarData} />
          </div>

          <div className="mt-4 grid shrink-0 grid-cols-2 gap-3">
            <MiniStat label="Selected Strategy" value={recommendation.title} compact />
            <MiniStat label="Compared" value={`${scenarios.length}`} />
          </div>
        </div>
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
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 font-semibold text-white ${compact ? "text-sm" : "text-lg"}`}>
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
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>
        {value}
      </div>
    </div>
  );
}

function CellValue({ value }: { value: string }) {
  return <div className="text-sm font-medium text-slate-200">{value}</div>;
}