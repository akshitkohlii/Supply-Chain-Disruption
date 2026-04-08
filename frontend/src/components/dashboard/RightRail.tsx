"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ApiRoutePrediction } from "@/lib/api";
import type { AlertItem } from "@/lib/mappers";

type RightRailProps = {
  selectedAlert: AlertItem | null;
  isOpen: boolean;
  onClose: () => void;
  mlPrediction?: ApiRoutePrediction | null;
  mlPredictionLoading?: boolean;
  mlPredictionError?: string | null;
};

function getSignalSourceLabel(sourceType: "news" | "weather" | "congestion") {
  if (sourceType === "weather") return "Weather";
  if (sourceType === "congestion") return "Congestion";
  return "News";
}

function getSignalSeverityUi(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "border-rose-400/20 bg-rose-500/10 text-rose-300";
  }
  if (severity === "medium") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
}

function getLevelUI(level: AlertItem["level"]) {
  if (level === "critical") {
    return {
      badge: "border-rose-400/20 bg-rose-500/10 text-rose-300",
      accent: "from-rose-500/18 via-rose-500/6 to-transparent",
    };
  }

  if (level === "warning") {
    return {
      badge: "border-amber-400/20 bg-amber-500/10 text-amber-300",
      accent: "from-amber-400/18 via-amber-400/6 to-transparent",
    };
  }

  return {
    badge: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
    accent: "from-cyan-400/18 via-cyan-400/6 to-transparent",
  };
}

function getBarColor(value: number) {
  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-cyan-400";
}

function normalizeScore(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatProbability(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${Math.round(value * 100)}%`;
}

function formatDelayHours(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(1)}h`;
}

function getPredictionBadge(predictedLabel?: string | null) {
  if (predictedLabel === "critical") {
    return "border-rose-400/20 bg-rose-500/10 text-rose-300";
  }
  if (predictedLabel === "warning") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
}

function buildDrivers(selectedAlert: AlertItem) {
  const weather = normalizeScore(selectedAlert.weatherRisk);
  const news = normalizeScore(selectedAlert.newsScore);
  const logistics = normalizeScore(selectedAlert.logisticsScore);
  const congestion = normalizeScore(selectedAlert.congestionScore);

  return [
    { label: "News Pressure", value: news },
    { label: "Weather Exposure", value: weather },
    { label: "Logistics Pressure", value: logistics },
    { label: "Port Congestion", value: congestion },
  ].sort((a, b) => b.value - a.value);
}

function buildRiskScore(selectedAlert: AlertItem) {
  if (typeof selectedAlert.finalRiskScore === "number") {
    return normalizeScore(selectedAlert.finalRiskScore);
  }

  const weather = normalizeScore(selectedAlert.weatherRisk);
  const news = normalizeScore(selectedAlert.newsScore);
  const logistics = normalizeScore(selectedAlert.logisticsScore);
  const congestion = normalizeScore(selectedAlert.congestionScore);

  return Math.round(weather * 0.25 + news * 0.2 + logistics * 0.3 + congestion * 0.25);
}

function buildConfidence(selectedAlert: AlertItem) {
  const availableSignals = [
    typeof selectedAlert.weatherRisk === "number",
    typeof selectedAlert.newsScore === "number",
    typeof selectedAlert.logisticsScore === "number",
    typeof selectedAlert.congestionScore === "number",
    !!selectedAlert.region,
    !!selectedAlert.country,
  ].filter(Boolean).length;

  return Math.min(96, 52 + availableSignals * 7);
}

export default function RightRail({
  selectedAlert,
  isOpen,
  onClose,
  mlPrediction = null,
  mlPredictionLoading = false,
  mlPredictionError = null,
}: RightRailProps) {
  if (!isOpen || !selectedAlert) return null;

  const levelUI = getLevelUI(selectedAlert.level);
  const drivers = buildDrivers(selectedAlert);
  const riskScore = buildRiskScore(selectedAlert);
  const confidence = buildConfidence(selectedAlert);

  const effectiveMlPrediction = mlPrediction
    ? mlPrediction
    : selectedAlert.mlRiskScore != null || selectedAlert.mlProbability != null
      ? {
          route_key: selectedAlert.routeKey ?? "",
          disruption_probability: selectedAlert.mlProbability ?? 0,
          predicted_label:
            selectedAlert.mlRiskScore != null && selectedAlert.mlRiskScore >= 70
              ? "critical"
              : selectedAlert.mlRiskScore != null && selectedAlert.mlRiskScore >= 40
                ? "warning"
                : "stable",
          ml_risk_score: selectedAlert.mlRiskScore ?? 0,
          predicted_delay_hours: selectedAlert.predictedDelayHours ?? 0,
          top_factors: selectedAlert.mlTopFactors ?? [],
        }
      : null;

  return (
    <aside className="w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedAlert.id}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="sticky top-4"
        >
          <div className="relative h-[39.25rem] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${levelUI.accent}`} />

            <div className="relative flex h-full flex-col">
              <div className="shrink-0 border-b border-slate-800/80 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Context Panel
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      Selected Route Alert
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
                    aria-label="Close context panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {selectedAlert.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Route: {selectedAlert.originPort ?? "Unknown"} →{" "}
                          {selectedAlert.destinationPort ?? "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Anchor Port: {selectedAlert.anchorPort ?? "Unknown"},{" "}
                          {selectedAlert.country}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${levelUI.badge}`}
                      >
                        {selectedAlert.level}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6 text-slate-300">{selectedAlert.summary}</p>
                  </section>

                  <section className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Risk Score
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">{riskScore}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Confidence
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">{confidence}%</div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Route Metadata
                    </div>

                    <div className="mt-4 space-y-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Category</span>
                        <span className="font-medium capitalize text-white">{selectedAlert.category}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Status</span>
                        <span className="font-medium capitalize text-white">{selectedAlert.status}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Route Key</span>
                        <span className="font-medium text-right text-white">{selectedAlert.routeKey ?? "N/A"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Origin Port</span>
                        <span className="font-medium text-white">{selectedAlert.originPort ?? "N/A"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Destination Port</span>
                        <span className="font-medium text-white">{selectedAlert.destinationPort ?? "N/A"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Anchor Port</span>
                        <span className="font-medium text-white">{selectedAlert.anchorPort ?? "N/A"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Region</span>
                        <span className="font-medium text-white">{selectedAlert.region ?? "Unknown"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Timestamp</span>
                        <span className="font-medium text-white">{selectedAlert.timestamp}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Root Cause Drivers
                    </div>

                    <div className="mt-4 space-y-3">
                      {drivers.map((driver) => (
                        <div key={driver.label}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-400">{driver.label}</span>
                            <span className="font-medium text-white">{driver.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className={`h-full rounded-full ${getBarColor(driver.value)}`}
                              style={{ width: `${driver.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Impact Snapshot
                    </div>

                    <div className="mt-4 space-y-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Final Risk</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.finalRiskScore === "number"
                            ? selectedAlert.finalRiskScore
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Weather Exposure</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.weatherRisk === "number"
                            ? `${normalizeScore(selectedAlert.weatherRisk)}%`
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">News Pressure</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.newsScore === "number"
                            ? `${normalizeScore(selectedAlert.newsScore)}%`
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Logistics Pressure</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.logisticsScore === "number"
                            ? `${normalizeScore(selectedAlert.logisticsScore)}%`
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Port Congestion</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.congestionScore === "number"
                            ? `${normalizeScore(selectedAlert.congestionScore)}%`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Emerging Signal Impact
                    </div>

                    <div className="mt-4 space-y-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Emerging Boost</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.emergingScore === "number"
                            ? `${selectedAlert.emergingScore}`
                            : "N/A"}
                        </span>
                      </div>

                      {!selectedAlert.emergingSignals?.length ? (
                        <div className="text-slate-400">
                          No emerging signals linked to this route.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedAlert.emergingSignals.slice(0, 3).map((signal) => (
                            <div
                              key={signal.signalId}
                              className="rounded-xl border border-slate-800/70 bg-slate-900/45 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-slate-100">
                                    {signal.title ??
                                      `${getSignalSourceLabel(signal.sourceType)} signal`}
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    {getSignalSourceLabel(signal.sourceType)}
                                    {signal.portName ? ` • ${signal.portName}` : ""}
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${getSignalSeverityUi(
                                      signal.severity
                                    )}`}
                                  >
                                    {signal.severity}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    +{signal.impactScore}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      ML Outlook
                    </div>

                    {mlPredictionLoading ? (
                      <div className="mt-4 text-xs text-slate-400">Loading ML prediction...</div>
                    ) : mlPredictionError ? (
                      <div className="mt-4 text-xs text-rose-300">{mlPredictionError}</div>
                    ) : effectiveMlPrediction ? (
                      <div className="mt-4 space-y-3 text-xs text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Predicted State</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getPredictionBadge(
                              effectiveMlPrediction.predicted_label
                            )}`}
                          >
                            {effectiveMlPrediction.predicted_label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Disruption Probability</span>
                          <span className="font-medium text-white">
                            {formatProbability(effectiveMlPrediction.disruption_probability)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">ML Risk Score</span>
                          <span className="font-medium text-white">
                            {effectiveMlPrediction.ml_risk_score}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Predicted Delay</span>
                          <span className="font-medium text-white">
                            {formatDelayHours(effectiveMlPrediction.predicted_delay_hours)}
                          </span>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-500">ML Confidence Bar</span>
                            <span className="font-medium text-white">
                              {effectiveMlPrediction.ml_risk_score} / 100
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className={`h-full rounded-full ${getBarColor(
                                effectiveMlPrediction.ml_risk_score
                              )}`}
                              style={{ width: `${effectiveMlPrediction.ml_risk_score}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            Top Factors
                          </div>

                          {effectiveMlPrediction.top_factors?.length ? (
                            <div className="space-y-2">
                              {effectiveMlPrediction.top_factors.map((factor, index) => (
                                <div
                                  key={`${factor}-${index}`}
                                  className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-3 py-2 text-slate-200"
                                >
                                  {factor}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400">No factor explanations available.</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-slate-400">
                        No ML prediction available for this route.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}