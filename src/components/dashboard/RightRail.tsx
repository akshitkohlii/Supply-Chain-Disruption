"use client";

import Panel from "./Panel";
import type { AlertItem } from "@/lib/dashboard-data";
import { rightRailDetails } from "@/lib/dashboard-data";

type RightRailProps = {
  selectedAlert: AlertItem | null;
};

function getLevelUI(level: AlertItem["level"]) {
  if (level === "critical") {
    return {
      badge: "bg-rose-500/10 border-rose-400/20 text-rose-300",
    };
  }
  if (level === "warning") {
    return {
      badge: "bg-amber-500/10 border-amber-400/20 text-amber-300",
    };
  }
  return {
    badge: "bg-emerald-500/10 border-emerald-400/20 text-emerald-300",
  };
}

function getBarColor(value: number) {
  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function RightRail({ selectedAlert }: RightRailProps) {
  const detail = selectedAlert
    ? rightRailDetails.find((d) => d.alertId === selectedAlert.id)
    : null;

  const levelUI = selectedAlert ? getLevelUI(selectedAlert.level) : null;

  return (
    <Panel title="Context Panel">
      {!selectedAlert || !detail ? (
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-400">
          Select an alert on the map to view detailed context, root causes, and impact scope.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {selectedAlert.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedAlert.location}, {selectedAlert.country}
                </p>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${levelUI?.badge}`}
              >
                {selectedAlert.level}
              </span>
            </div>

            <div className="mt-3">
              <span className="rounded-full border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 text-[11px] capitalize text-slate-300">
                Status: {selectedAlert.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Metric label="Risk Score" value={`${detail.riskScore}`} />
            <Metric label="Confidence" value={`${detail.confidence}%`} />
            <Metric label="Impacted Lanes" value={`${detail.impactedLanes}`} />
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Root Cause Breakdown
            </div>

            <div className="mt-3 space-y-3">
              {detail.rootCauses.map((rc) => (
                <div key={rc.label}>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{rc.label}</span>
                    <span className="text-slate-300">{rc.value}</span>
                  </div>

                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                    <div
                      className={`h-1.5 rounded-full ${getBarColor(rc.value)}`}
                      style={{ width: `${rc.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Impact Scope
            </div>

            <div className="mt-2 space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Affected Area:</span>{" "}
                {detail.affectedArea}
              </p>
              <p>
                <span className="text-slate-500">ETA Impact:</span>{" "}
                {detail.etaImpact}
              </p>
            </div>
          </div>
        </div>
      )}
    </Panel>
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
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
    </div>
  );
}