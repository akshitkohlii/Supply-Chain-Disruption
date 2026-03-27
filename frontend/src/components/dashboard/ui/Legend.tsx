
type LegendProps = {
  color: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function Legend({
  color,
  label,
  active = false,
  onClick,
}: LegendProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
        active
          ? "border-slate-500 bg-slate-800 text-white"
          : "border-slate-800 bg-slate-950/70 hover:bg-slate-800"
      }`}
    >
      <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-300">{label}</span>
    </button>
  );
}
