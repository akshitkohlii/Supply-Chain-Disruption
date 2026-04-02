"use client";

import Panel from "./Panel";
import SupplierRiskChart from "./charts/SupplierRiskChart";
import LogisticTransportChart from "./charts/LogisticTransportChart";
import PredictiveRiskChart from "./charts/PredictiveRiskChart";

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

export default function MidCardsSection({
  supplierExposureData,
  lanePressureData,
  forecastData,
  analyticsOverview,
  isLoading = false,
}: MidCardsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Panel title="Supplier Risk & Dependency" className="xl:col-span-4">
        <SupplierRiskChart data={supplierExposureData} isLoading={isLoading} />
      </Panel>

      <Panel title="Logistics & Transportation" className="xl:col-span-4">
        <LogisticTransportChart data={lanePressureData} isLoading={isLoading} />
      </Panel>

      <Panel title="Predictive Analysis" className="xl:col-span-4">
        <PredictiveRiskChart
          data={forecastData}
          overview={analyticsOverview}
          isLoading={isLoading}
        />
      </Panel>
    </div>
  );
}