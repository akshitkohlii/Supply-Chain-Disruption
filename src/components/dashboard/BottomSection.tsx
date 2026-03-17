import Panel from "./Panel";
import BlankChart from "./ui/BlankChart";

export default function BottomSection() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Panel title="Scenario Simulation Lab" className="xl:col-span-7">
        <BlankChart h="h-[260px]" />
      </Panel>

      <Panel
        title="AI Mitigation & Recommendation Engine"
        className="xl:col-span-5"
      >
        <BlankChart h="h-[260px]" />
      </Panel>
    </div>
  );
}
