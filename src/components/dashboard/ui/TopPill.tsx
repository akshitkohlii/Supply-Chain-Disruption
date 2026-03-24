
import { ChevronDown } from "lucide-react";

type TopPillProps = {
  label: string;
  icon?: React.ReactNode;
  value?: string;
  options?: string[];
  onChange?: (value: string) => void;
};

export default function TopPill({
  label,
  icon,
  value,
  options,
  onChange,
}: TopPillProps) {
  if (options && onChange && value) {
    return (
      <div className="relative h-11 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 flex items-center gap-2 text-sm text-slate-300 hover:text-white">
        {icon}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent pr-5 outline-none text-sm text-slate-300"
        >
          {options.map((option) => (
            <option
              key={option}
              value={option}
              className="bg-slate-900 text-slate-100"
            >
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
    );
  }

  return (
    <button className="h-11 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 flex items-center gap-2 text-sm text-slate-300 hover:text-white">
      {icon}
      <span>{label}</span>
      <ChevronDown className="h-4 w-4 text-slate-500" />
    </button>
  );
}
