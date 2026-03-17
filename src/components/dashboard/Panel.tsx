type PanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function Panel({ title, children, className = "" }: PanelProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-slate-950/45 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.30)] ${className}`}
    >
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <h2 className="text-sm md:text-base font-semibold tracking-wide text-slate-100">
          {title}
        </h2>
        <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}
