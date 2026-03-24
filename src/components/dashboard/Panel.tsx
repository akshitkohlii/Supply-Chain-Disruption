
type PanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

export default function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
}: PanelProps) {
  return (
    <div
      className={`flex flex-col rounded-3xl border border-slate-800/80 bg-slate-950/45 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.30)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 shrink-0">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100 md:text-base">
          {title}
        </h2>
        <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
      </div>

      <div className={`min-h-0 flex-1 px-4 pb-4 pt-2 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
