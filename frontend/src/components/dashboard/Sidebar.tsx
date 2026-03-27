"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bird } from "lucide-react";
import { navItems } from "@/lib/dashboard-data";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group hidden lg:flex h-screen w-20 hover:w-60 shrink-0 transition-all duration-300 border-r border-slate-800/80 bg-slate-950/75 backdrop-blur-xl flex-col overflow-hidden">
      
      <div className="h-20.25 border-b-2 border-slate-800/80 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 w-full">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
            <Bird className="h-5 w-5" />
          </div>

          <div className="overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              SCDEWS
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative w-full flex items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
                active
                  ? "bg-cyan-500/10 border border-cyan-400/20 text-cyan-200"
                  : "border border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full bg-cyan-400" />
              )}

              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "bg-slate-900/70 text-slate-400"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm font-medium whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}