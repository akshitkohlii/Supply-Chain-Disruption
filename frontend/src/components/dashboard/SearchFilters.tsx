"use client";

import { Search } from "lucide-react";
import GlassBox from "./GlassBox";
import FilterBox from "./ui/FilterBox";

type SearchFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
  businessUnit: string;
  onBusinessUnitChange: (value: string) => void;
  riskLevel: string;
  onRiskLevelChange: (value: string) => void;
};

export default function SearchFilters({
  search,
  onSearchChange,
  region,
  onRegionChange,
  businessUnit,
  onBusinessUnitChange,
  riskLevel,
  onRiskLevelChange,
}: SearchFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))]">
      <GlassBox className="flex h-14 items-center gap-3 px-4">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search supplier, route, port, alert..."
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
        />
      </GlassBox>

      <FilterBox
        label="Region"
        value={region}
        options={[
          "All Regions",
          "Asia",
          "Europe",
          "North America",
          "South America",
        ]}
        onChange={onRegionChange}
      />

      <FilterBox
        label="Business Unit"
        value={businessUnit}
        options={["All Units", "Global Ops", "Logistics", "Risk"]}
        onChange={onBusinessUnitChange}
      />

      <FilterBox
        label="Risk Level"
        value={riskLevel}
        options={["All Levels", "Stable", "Warning", "Critical"]}
        onChange={onRiskLevelChange}
      />
    </div>
  );
}