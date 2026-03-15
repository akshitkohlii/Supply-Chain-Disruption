import { Bird } from "lucide-react";
import { navItems } from "@/lib/dashboard-data";

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-20 hover:w-64 transition-all duration-300 group border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-xl flex-col">
      <div className="h-20 flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 w-full">
          <div className="h-11 w-11 flex items-center justify-center ">
            <Bird className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="hidden group-hover:block overflow-hidden">
            <div className="text-sm font-semibold tracking-wide text-white whitespace-nowrap">
              SCDEWS
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = index === 0;

          return (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
                active
                  ? "bg-cyan-500/10 border border-cyan-400/20 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.10)]"
                  : "border border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden group-hover:block text-sm whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
