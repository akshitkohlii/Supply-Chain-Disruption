type LayerChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function LayerChip({
  label,
  active = false,
  onClick,
}: LayerChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-xs border transition ${
        active
          ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
          : "border-slate-700 bg-slate-900/70 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}