import type { AlertItem } from "@/lib/dashboard-data";
import clsx from "clsx";

type AlertRowProps = {
  alert: AlertItem;
  active?: boolean;
  onClick?: () => void;
};

export default function AlertRow({
  alert,
  active = false,
  onClick,
}: AlertRowProps) {
  const levelClasses =
    alert.level === "critical"
      ? "bg-rose-400"
      : alert.level === "warning"
      ? "bg-amber-400"
      : "bg-cyan-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-xl border p-3 text-left transition",
        active
          ? "border-cyan-400/60 bg-slate-800/80"
          : "border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/60"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={clsx("mt-1 h-2.5 w-2.5 rounded-full", levelClasses)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-white">{alert.title}</p>
            <span className="text-[11px] text-slate-400">{alert.timestamp}</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {alert.location}, {alert.country}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400">
            {alert.summary}
          </p>
        </div>
      </div>
    </button>
  );
}