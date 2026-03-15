type GlassBoxProps = {
  children: React.ReactNode;
  className?: string;
};

export default function GlassBox({
  children,
  className = "",
}: GlassBoxProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-950/50 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}
