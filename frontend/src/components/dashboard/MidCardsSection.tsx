"use client";

import dynamic from "next/dynamic";
import Panel from "./Panel";

import type {
  ApiAnalyticsOverview,
  ApiForecastPoint,
  ApiLanePressureItem,
  ApiSupplierExposureItem,
} from "@/lib/api";

type MidCardsSectionProps = {
  supplierExposureData: ApiSupplierExposureItem[];
  lanePressureData: ApiLanePressureItem[];
  forecastData: ApiForecastPoint[];
  analyticsOverview: ApiAnalyticsOverview | null;
  isLoading?: boolean;
};

const chartLoadingState = (
  <div className="flex h-[420px] items-center justify-center text-sm text-slate-400">
    Loading chart...
  </div>
);

const SupplierRiskChart = dynamic(() => import("./charts/SupplierRiskChart"), {
  loading: () => chartLoadingState,
});

const LogisticTransportChart = dynamic(
  () => import("./charts/LogisticTransportChart"),
  {
    loading: () => chartLoadingState,
  }
);

const PredictiveRiskChart = dynamic(() => import("./charts/PredictiveRiskChart"), {
  loading: () => chartLoadingState,
});

export default function MidCardsSection({
  supplierExposureData,
  lanePressureData,
  forecastData,
  analyticsOverview,
  isLoading = false,
}: MidCardsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Panel title="Supplier Exposure Breakdown" className="xl:col-span-4">
        <SupplierRiskChart data={supplierExposureData} isLoading={isLoading} />
      </Panel>

      <Panel title="Lane Pressure Monitor" className="xl:col-span-4">
        <LogisticTransportChart data={lanePressureData} isLoading={isLoading} />
      </Panel>

      <Panel title="Modeled Route Risk Trend" className="xl:col-span-4">
        <PredictiveRiskChart
          data={forecastData}
          overview={analyticsOverview}
          isLoading={isLoading}
        />
      </Panel>
    </div>
  );
}
