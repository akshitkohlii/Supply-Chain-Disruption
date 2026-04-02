"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { AlertItem } from "@/lib/mappers";

type RightRailProps = {
  selectedAlert: AlertItem | null;
  isOpen: boolean;
  onClose: () => void;
};

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

function toPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function buildDrivers(selectedAlert: AlertItem) {
  const weather = toPercent(selectedAlert.weatherRisk);
  const congestion = toPercent(selectedAlert.portCongestion);
  const delay = Math.max(
    0,
    Math.min(100, Math.round(((selectedAlert.delayHours ?? 0) / 48) * 100))
  );

  const drivers = [
    { label: "Weather Exposure", value: weather },
    { label: "Port Congestion", value: congestion },
    { label: "Delay Pressure", value: delay },
  ];

  return drivers.sort((a, b) => b.value - a.value);
}

function buildRiskScore(selectedAlert: AlertItem) {
  const weather = toPercent(selectedAlert.weatherRisk);
  const congestion = toPercent(selectedAlert.portCongestion);
  const delay = Math.max(
    0,
    Math.min(100, Math.round(((selectedAlert.delayHours ?? 0) / 48) * 100))
  );

  const levelBase =
    selectedAlert.level === "critical"
      ? 78
      : selectedAlert.level === "warning"
        ? 58
        : 34;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(levelBase * 0.45 + weather * 0.2 + congestion * 0.2 + delay * 0.15)
    )
  );
}

function buildConfidence(selectedAlert: AlertItem) {
  const availableSignals = [
    typeof selectedAlert.delayHours === "number",
    typeof selectedAlert.weatherRisk === "number",
    typeof selectedAlert.portCongestion === "number",
    !!selectedAlert.region,
    !!selectedAlert.country,
  ].filter(Boolean).length;

  return Math.min(96, 52 + availableSignals * 9);
}

export default function RightRail({
  selectedAlert,
  isOpen,
  onClose,
}: RightRailProps) {
  if (!isOpen || !selectedAlert) return null;

  const levelUI = getLevelUI(selectedAlert.level);
  const drivers = buildDrivers(selectedAlert);
  const riskScore = buildRiskScore(selectedAlert);
  const confidence = buildConfidence(selectedAlert);

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
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${levelUI.accent}`}
            />

            <div className="relative flex h-full flex-col">
              <div className="shrink-0 border-b border-slate-800/80 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Context Panel
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      Selected Entity Details
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
                          {selectedAlert.location}, {selectedAlert.country}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${levelUI.badge}`}
                      >
                        {selectedAlert.level}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6 text-slate-300">
                      {selectedAlert.summary}
                    </p>
                  </section>

                  <section className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Risk Score
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {riskScore}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Confidence
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {confidence}%
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Alert Metadata
                    </div>

                    <div className="mt-4 space-y-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Category</span>
                        <span className="font-medium capitalize text-white">
                          {selectedAlert.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Status</span>
                        <span className="font-medium capitalize text-white">
                          {selectedAlert.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Region</span>
                        <span className="font-medium text-white">
                          {selectedAlert.region ?? "Unknown"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Supplier</span>
                        <span className="font-medium text-white">
                          {selectedAlert.supplierName ?? "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Timestamp</span>
                        <span className="font-medium text-white">
                          {selectedAlert.timestamp}
                        </span>
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
                        <span className="text-slate-500">Delay Impact</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.delayHours === "number"
                            ? `${selectedAlert.delayHours.toFixed(1)} hours`
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Weather Exposure</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.weatherRisk === "number"
                            ? `${toPercent(selectedAlert.weatherRisk)}%`
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Port Congestion</span>
                        <span className="font-medium text-white">
                          {typeof selectedAlert.portCongestion === "number"
                            ? `${toPercent(selectedAlert.portCongestion)}%`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
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