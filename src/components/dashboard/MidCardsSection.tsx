
import Panel from "./Panel";
import SupplierRiskChart from "./charts/SupplierRiskChart";
import LogisticsTransportChart from "./charts/LogisticTransportChart";
import PredictiveRiskChart from "./charts/PredictiveRiskChart";

export default function MidCardsSection() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Panel
        title="Supplier Risk & Dependency"
        className="xl:col-span-4 h-100"
        bodyClassName="min-h-0"
      >
        <SupplierRiskChart />
      </Panel>

      <Panel
        title="Logistics & Transportation"
        className="xl:col-span-4 h-100"
        bodyClassName="min-h-0"
      >
        <LogisticsTransportChart />
      </Panel>

      <Panel
        title="Predictive Risk Analytics"
        className="xl:col-span-4 h-100"
        bodyClassName="min-h-0"
      >
        <PredictiveRiskChart />
      </Panel>
    </div>
  );
}
