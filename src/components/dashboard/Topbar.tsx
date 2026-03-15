import { Bell, Globe2, ShieldAlert, UserCircle2 } from "lucide-react";
import TopPill from "./ui/TopPill";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
      <div className="px-4 md:px-6 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="lg:hidden h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/80 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-semibold tracking-wide text-white truncate">
              Supply Chain Disruption Early Warning System
            </h1>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-3">
          <TopPill icon={<Globe2 className="h-4 w-4" />} label="Global" />
          <TopPill label="Last 7 Days" />
          <TopPill label="Alerts" />

          <button className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/80 flex items-center justify-center text-slate-300 hover:text-white">
            <Bell className="h-5 w-5" />
          </button>

          <button className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/80 flex items-center justify-center text-slate-300 hover:text-white">
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
