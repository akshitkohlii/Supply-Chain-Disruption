import Panel from "./Panel";
import BlankChart from "./ui/BlankChart";

export default function MidCardsSection() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Panel title="Supplier Risk & Dependency" className="xl:col-span-4">
        <BlankChart h="h-[220px]" />
      </Panel>

      <Panel title="Logistics & Transportation" className="xl:col-span-4">
        <BlankChart h="h-[220px]" />
      </Panel>

      <Panel title="Predictive Risk Analytics" className="xl:col-span-4">
        <BlankChart h="h-[220px]" />
      </Panel>
    </div>
  );
}
