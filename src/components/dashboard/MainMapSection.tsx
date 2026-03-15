import Panel from "./Panel";

export default function MainMapSection() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Panel title="Global Disruption Risk Map" className="xl:col-span-8">
        <div className="h-90 rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,14,25,0.95))] relative overflow-hidden">
          <div className="absolute inset-6 rounded-2xl border border-dashed border-slate-700/80" />
        </div>
      </Panel>
    </div>
  );
}
