type KpiCardProps = {
  title: string;
  accent: number;
};

export default function KpiCard({ title, accent }: KpiCardProps) {
  const accentGlow = [
    "from-cyan-500/15 to-blue-500/5",
    "from-rose-500/15 to-red-500/5",
    "from-amber-500/15 to-yellow-500/5",
    "from-sky-500/15 to-cyan-500/5",
    "from-violet-500/15 to-fuchsia-500/5",
    "from-emerald-500/15 to-teal-500/5",
  ][accent % 6];

  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-linear-to-br ${accentGlow} bg-slate-950/55 backdrop-blur-xl p-4 shadow-[0_10px_28px_rgba(0,0,0,0.28)]`}
    >
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>

      <div className="mt-3 h-8 w-24 rounded-lg bg-slate-800/80 text-center p-1 text-md font-extrabold text-green-600" >
      <span>123</span>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-cyan-400/70" />
      </div>
    </div>
  );
}
