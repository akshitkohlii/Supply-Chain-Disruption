"use client";

import type { AlertItem } from "@/lib/dashboard-data";
import { Check, CheckCheck, Clock3 } from "lucide-react";

type AlertRowProps = {
  alert: AlertItem;
  active: boolean;
  onClick: () => void;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
};

function getLevelDot(level: AlertItem["level"]) {
  if (level === "critical") return "bg-rose-400";
  if (level === "warning") return "bg-amber-400";
  return "bg-emerald-400";
}

export default function AlertRow({
  alert,
  active,
  onClick,
  onAcknowledge,
  onResolve,
}: AlertRowProps) {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border p-3 transition ${active
          ? "border-indigo-400/30 bg-indigo-500/5"
          : "border-slate-800/60 bg-transparent hover:bg-slate-900/40"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getLevelDot(
              alert.level
            )}`}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {alert.title}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {alert.location}, {alert.country}
            </p>

            <p className="mt-1 text-xs text-slate-400">{alert.summary}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="whitespace-nowrap text-[11px] text-slate-500">
            {alert.timestamp}
          </span>

          {alert.status === "active" && (
            <div className="flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <IconActionButton
                label="Acknowledge"
                tone="amber"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge?.(alert.id);
                }}
              >
                <Check className="h-4 w-4" />
              </IconActionButton>

              <IconActionButton
                label="Resolve"
                tone="emerald"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(alert.id);
                }}
              >
                <CheckCheck className="h-4 w-4" />
              </IconActionButton>
            </div>
          )}

          {alert.status === "acknowledged" && (
  <div className="flex items-center gap-2">
    <StatusBadge label="Acknowledged" tone="amber">
      <Clock3 className="h-3.5 w-3.5" />
    </StatusBadge>

    <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <IconActionButton
        label="Resolve"
        tone="emerald"
        onClick={(e) => {
          e.stopPropagation();
          onResolve?.(alert.id);
        }}
      >
        <CheckCheck className="h-4 w-4" />
      </IconActionButton>
    </div>
  </div>
)}

          {alert.status === "resolved" && (
            <StatusBadge label="Resolved" tone="emerald">
              <CheckCheck className="h-3.5 w-3.5" />
            </StatusBadge>
          )}
        </div>
      </div>
    </div>
  );
}

function IconActionButton({
  label,
  tone,
  children,
  onClick,
}: {
  label: string;
  tone: "amber" | "emerald";
  children: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-400/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:shadow-[0_0_10px_rgba(251,191,36,0.35)]"
      : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(52,211,153,0.35)]";

  return (
    <div className="group/btn relative">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${styles}`}
      >
        <span className="transition-transform group-hover/btn:scale-110">
          {children}
        </span>
      </button>

      <div className="pointer-events-none absolute -top-8 right-0 rounded-md border border-slate-700/80 bg-slate-950/95 px-2 py-1 text-[10px] text-slate-300 opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover/btn:opacity-100">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "amber" | "emerald";
  children: React.ReactNode;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
      : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${styles}`}
    >
      {children}
      <span>{label}</span>
    </div>
  );
}