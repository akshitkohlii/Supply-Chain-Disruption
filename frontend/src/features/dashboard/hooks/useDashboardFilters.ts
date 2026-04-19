"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAppSettings } from "@/lib/settings";
import type {
  DashboardFiltersState,
  LayerFilter,
  LevelFilter,
  RiskLevelFilter,
  ScopeFilter,
  StatusFilter,
  TimeFilter,
} from "../lib/types";

export function useDashboardFilters() {
  const initialSettings = loadAppSettings();
  const userRegion = initialSettings.defaultRegion;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [region, setRegion] = useState("All Regions");
  const [businessUnit, setBusinessUnit] = useState("All Units");
  const [riskLevel, setRiskLevel] = useState<RiskLevelFilter>("All Levels");

  const [activeLayer, setActiveLayer] = useState<LayerFilter>("all");
  const [activeLevel, setActiveLevel] = useState<LevelFilter>("all");

  const [scope, setScope] = useState<ScopeFilter>("Global");
  const [timeRange, setTimeRange] = useState<TimeFilter>(
    initialSettings.defaultTimeRange as TimeFilter
  );
  const [status, setStatus] = useState<StatusFilter>("All");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const handleRiskLevelChange = (value: string) => {
    setRiskLevel(value as RiskLevelFilter);
  };

  const filters: DashboardFiltersState = useMemo(
    () => ({
      searchInput,
      debouncedSearch,
      region,
      userRegion,
      businessUnit,
      riskLevel,
      activeLayer,
      activeLevel,
      scope,
      timeRange,
      status,
    }),
    [
      searchInput,
      debouncedSearch,
      region,
      userRegion,
      businessUnit,
      riskLevel,
      activeLayer,
      activeLevel,
      scope,
      timeRange,
      status,
    ]
  );

  return {
    filters,
    searchInput,
    setSearchInput,
    region,
    setRegion,
    businessUnit,
    setBusinessUnit,
    riskLevel,
    setRiskLevel,
    handleRiskLevelChange,
    activeLayer,
    setActiveLayer,
    activeLevel,
    setActiveLevel,
    scope,
    setScope,
    timeRange,
    setTimeRange,
    status,
    setStatus,
  };
}
