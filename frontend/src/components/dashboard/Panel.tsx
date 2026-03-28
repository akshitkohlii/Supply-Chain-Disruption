type PanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string; // ✅ match your project
  action?: React.ReactNode;
};

export default function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
  action,
}: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.72))] shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${className}`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">
          {title}
        </h2>

        {action && <div>{action}</div>}
      </div>

      {/* BODY */}
      <div className={`p-5 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}