
"use client";

import { useMemo, useState } from "react";
import { Bell, Globe2, UserCircle2, X, CheckCheck } from "lucide-react";
import TopPill from "./ui/TopPill";
import type { AlertItem } from "@/lib/dashboard-data";

type ScopeFilter = "Global" | "Regional";
type TimeFilter = "Last 24 Hours" | "Last 7 Days" | "Last 30 Days";
type StatusFilter = "All" | "Alerts" | "Acknowledged" | "Resolved";

type TopbarProps = {
  scope: ScopeFilter;
  onScopeChange: (value: ScopeFilter) => void;
  timeRange: TimeFilter;
  onTimeRangeChange: (value: TimeFilter) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  notifications: AlertItem[];
  onSelectNotification?: (alert: AlertItem) => void;
};

function getLevelDot(level: AlertItem["level"]) {
  if (level === "critical") return "bg-rose-400";
  if (level === "warning") return "bg-amber-400";
  return "bg-cyan-400";
}

export default function Topbar({
  scope,
  onScopeChange,
  timeRange,
  onTimeRangeChange,
  status,
  onStatusChange,
  notifications,
  onSelectNotification,
}: TopbarProps) {
  const [open, setOpen] = useState(false);

  const activeNotifications = useMemo(
    () => notifications.filter((item) => item.status === "active"),
    [notifications]
  );

  return (
    <header className="h-20 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-wide text-white md:text-2xl">
              Supply Chain Disruption Early Warning System
            </h1>
          </div>
        </div>

        <div className="hidden items-center gap-3 xl:flex">
          <TopPill
            icon={<Globe2 className="h-4 w-4" />}
            label={scope}
            value={scope}
            options={["Global", "Regional"]}
            onChange={(value) => onScopeChange(value as ScopeFilter)}
          />

          <TopPill
            label={timeRange}
            value={timeRange}
            options={["Last 24 Hours", "Last 7 Days", "Last 30 Days"]}
            onChange={(value) => onTimeRangeChange(value as TimeFilter)}
          />

          <TopPill
            label={status}
            value={status}
            options={["All", "Alerts", "Acknowledged", "Resolved"]}
            onChange={(value) => onStatusChange(value as StatusFilter)}
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-slate-900 hover:text-white hover:shadow-[0_0_18px_rgba(34,211,238,0.25)] active:scale-95"
            >
              <Bell className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />

              {activeNotifications.length > 0 && (
                <span className="absolute -right-1 -top-1 h-4.5 min-w-4.5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4.5 text-white">
                  {activeNotifications.length}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-3 w-95 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Notifications
                    </h3>
                    <p className="text-xs text-slate-400">
                      {activeNotifications.length} active alerts
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-90 overflow-y-auto p-2">
                  {activeNotifications.length > 0 ? (
                    <div className="space-y-2">
                      {activeNotifications.map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition hover:bg-slate-800/70"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectNotification?.(alert);
                              setOpen(false);
                            }}
                            className="w-full text-left"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 h-2.5 w-2.5 rounded-full ${getLevelDot(alert.level)}`}
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-medium text-white">
                                    {alert.title}
                                  </p>

                                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                    {alert.timestamp}
                                  </span>
                                </div>

                                <p className="mt-1 text-xs text-slate-400 truncate">
                                  {alert.location}, {alert.country}
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
                      No active notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 text-slate-300 transition hover:text-white">
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
