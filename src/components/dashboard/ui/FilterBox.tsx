
"use client";

import { ChevronDown } from "lucide-react";

type FilterBoxProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export default function FilterBox({
  label,
  value,
  options,
  onChange,
}: FilterBoxProps) {
  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-950/50 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)] px-4 h-14 flex items-center">
      <div className="w-full">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">
          {label}
        </div>

        <div className="relative mt-0.5">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-transparent text-sm text-slate-200 outline-none pr-6"
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

          <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        </div>
      </div>
    </div>
  );
}
