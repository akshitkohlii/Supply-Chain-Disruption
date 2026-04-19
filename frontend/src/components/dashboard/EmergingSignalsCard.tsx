"use client";

import Panel from "./Panel";
import type { ApiEmergingSignal } from "@/lib/api";

type EmergingSignalsCardProps = {
  signals: ApiEmergingSignal[];
  isLoading?: boolean;
  error?: string | null;
};

function getSeverityUi(severity: ApiEmergingSignal["severity"]) {
  if (severity === "high") {
    return {
      dot: "bg-rose-400",
      pill: "border-rose-400/20 bg-rose-500/10 text-rose-300",
    };
  }

  if (severity === "medium") {
    return {
      dot: "bg-amber-400",
      pill: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    dot: "bg-cyan-400",
    pill: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
  };
}

function getSourceUi(sourceType: ApiEmergingSignal["source_type"]) {
  if (sourceType === "weather") return "Weather";
  if (sourceType === "congestion") return "Congestion";
  return "News";
}

function getRiskTypeUi(riskType: ApiEmergingSignal["risk_type"]) {
  if (riskType === "geo") return "Geopolitical";
  if (riskType === "weather") return "Weather";
  if (riskType === "congestion") return "Congestion";
  if (riskType === "logistics") return "Logistics";
  return "Mixed";
}

function formatProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function EmergingSignalsCard({
  signals,
  isLoading = false,
  error = null,
}: EmergingSignalsCardProps) {
  return (
    <Panel
      title="Emerging Risk Signals"
      className="h-80"
      bodyClassName="h-full overflow-hidden"
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Ranked weak signals from news, weather, and congestion intelligence
          </div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Live ranking
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Loading emerging signals...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
            {error}
          </div>
        ) : !signals.length ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            No emerging signals available
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {signals.map((signal) => {
                const severityUi = getSeverityUi(signal.severity);

                return (
                  <div
                    key={signal.signal_id}
                    className="rounded-2xl border border-slate-800/70 bg-slate-950/50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${severityUi.dot}`} />
                          <span className="truncate text-sm font-medium text-white">
                            {signal.title}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{getSourceUi(signal.source_type)}</span>
                          <span>•</span>
                          <span>{getRiskTypeUi(signal.risk_type)}</span>
                          <span>•</span>
                          <span>
                            {signal.port_name ?? "Unknown Port"}
                            {signal.country ? `, ${signal.country}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${severityUi.pill}`}
                        >
                          {signal.severity}
                        </span>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            Score
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {signal.emerging_score}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">
                      {signal.summary}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <div className="text-slate-500">
                        Relevance:{" "}
                        <span className="font-medium text-slate-200">
                          {formatProbability(signal.relevance_probability)}
                        </span>
                      </div>

                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800/80">
                        <div
                          className={`h-full rounded-full ${
                            signal.emerging_score >= 80
                              ? "bg-rose-500"
                              : signal.emerging_score >= 50
                                ? "bg-amber-400"
                                : "bg-cyan-400"
                          }`}
                          style={{ width: `${signal.emerging_score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}