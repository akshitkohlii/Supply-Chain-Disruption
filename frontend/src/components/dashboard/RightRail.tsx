"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { AlertItem } from "@/lib/dashboard-data";
import { rightRailDetails } from "@/lib/dashboard-data";

type RightRailProps = {
  selectedAlert: AlertItem | null;
  isOpen: boolean;
  onClose: () => void;
};

function getLevelUI(level: AlertItem["level"]) {
  if (level === "critical") {
    return {
      badge: "border-rose-400/20 bg-rose-500/10 text-rose-300",
    };
  }

  if (level === "warning") {
    return {
      badge: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    badge: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
  };
}

function getBarColor(value: number) {
  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-cyan-400";
}

export default function RightRail({
  selectedAlert,
  isOpen,
  onClose,
}: RightRailProps) {
  const detail = selectedAlert
    ? rightRailDetails.find((d) => d.alertId === selectedAlert.id)
    : null;

  if (!isOpen || !selectedAlert || !detail) return null;

  const levelUI = getLevelUI(selectedAlert.level);

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
          <div className="h-157 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="flex h-full flex-col">
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
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize ${levelUI.badge}`}
                      >
                        {selectedAlert.level}
                      </span>
                    </div>

                    <div className="mt-3">
                      <span className="rounded-full border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 text-[11px] capitalize text-slate-300">
                        Status: {selectedAlert.status}
                      </span>
                    </div>
                  </section>

                  <section className="grid grid-cols-3 gap-3">
                    <Metric label="Risk Score" value={`${detail.riskScore}`} />
                    <Metric label="Confidence" value={`${detail.confidence}%`} />
                    <Metric
                      label="Impacted Lanes"
                      value={`${detail.impactedLanes}`}
                    />
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Root Cause Breakdown
                    </div>

                    <div className="mt-3 space-y-3">
                      {detail.rootCauses.map((rc) => (
                        <div key={rc.label}>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{rc.label}</span>
                            <span className="text-slate-300">{rc.value}</span>
                          </div>

                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
                            <div
                              className={`h-1.5 rounded-full ${getBarColor(
                                rc.value
                              )}`}
                              style={{ width: `${rc.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Impact Scope
                    </div>

                    <div className="mt-3 space-y-3">
                      <ImpactRow
                        label="Affected Area"
                        value={detail.affectedArea}
                      />
                      <ImpactRow label="ETA Impact" value={detail.etaImpact} />
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 break-words">
        {label}
      </div>

      <div className="mt-2 min-w-0 text-sm font-semibold leading-tight text-white break-words">
        {value}
      </div>
    </div>
  );
}

function ImpactRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1.5 text-sm text-slate-200">{value}</div>
    </div>
  );
}