"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import GlassBox from "./GlassBox";
import FilterBox from "./ui/FilterBox";

export default function SearchFilters() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [businessUnit, setBusinessUnit] = useState("Global Ops");
  const [riskLevel, setRiskLevel] = useState("All Levels");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-4">
      <GlassBox className="h-14 px-4 flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier, route, port, alert..."
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
        />
      </GlassBox>

      <FilterBox
        label="Region"
        value={region}
        options={["All Regions", "Asia", "Europe", "North America", "Middle East"]}
        onChange={setRegion}
      />

      <FilterBox
        label="Business Unit"
        value={businessUnit}
        options={["Global Ops", "Logistics", "Risk"]}
        onChange={setBusinessUnit}
      />

      <FilterBox
        label="Risk Level"
        value={riskLevel}
        options={["All Levels", "Low", "Medium", "High", "Critical"]}
        onChange={setRiskLevel}
      />
    </div>
  );
}