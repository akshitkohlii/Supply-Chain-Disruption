
type MapDotProps = {
  className: string;
  warn?: boolean;
  danger?: boolean;
};

export default function MapDot({
  className,
  warn = false,
  danger = false,
}: MapDotProps) {
  const tone = danger
    ? "bg-rose-400 shadow-[0_0_24px_rgba(251,113,133,0.8)]"
    : warn
    ? "bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]"
    : "bg-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.8)]";

  return (
    <div className={`absolute ${className}`}>
      <div className={`h-3 w-3 rounded-full ${tone}`} />
      <div
        className={`absolute inset-0 h-3 w-3 rounded-full animate-ping ${tone} opacity-30`}
      />
    </div>
  );
}
