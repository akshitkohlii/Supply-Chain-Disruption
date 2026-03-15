import { ChevronDown } from "lucide-react";

type TopPillProps = {
  label: string;
  icon?: React.ReactNode;
};

export default function TopPill({ label, icon }: TopPillProps) {
  return (
    <button className="h-11 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 flex items-center gap-2 text-sm text-slate-300 hover:text-white">
      {icon}
      <span>{label}</span>
      <ChevronDown className="h-4 w-4 text-slate-500" />
    </button>
  );
}
