import Panel from "./Panel";
import LayerChip from "./ui/LayerChip";
import Legend from "./ui/Legend";
import AlertRow from "./ui/AlertRow";
import MiniStat from "./ui/MiniStat";
import WorldRiskMap from "./WorldriskMap";
import type { AlertItem } from "@/lib/dashboard-data";
import { emergingSignals } from "@/lib/dashboard-data";


type LayerFilter = "all" | "supplier" | "port" | "climate" | "geo" | "logistics";
type LevelFilter = "all" | "stable" | "warning" | "critical";

type MainMapSectionProps = {
  alerts: AlertItem[];
  selectedAlert: AlertItem | null;
  onSelectAlert: (alert: AlertItem) => void;
  activeLayer: LayerFilter;
  onLayerChange: (layer: LayerFilter) => void;
  activeLevel: LevelFilter;
  onLevelChange: (level: LevelFilter) => void;
};

export default function MainMapSection({
  alerts,
  selectedAlert,
  onSelectAlert,
  activeLayer,
  onLayerChange,
  activeLevel,
  onLevelChange,
}: MainMapSectionProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Panel title="Global Disruption Risk Map" className="xl:col-span-8">
        <div className="h-135 rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,14,25,0.95))] flex flex-col p-4 gap-3">
          <div className="relative z-20 flex gap-2 flex-wrap">
            <LayerChip
              label="All"
              active={activeLayer === "all"}
              onClick={() => onLayerChange("all")}
            />
            <LayerChip
              label="Suppliers"
              active={activeLayer === "supplier"}
              onClick={() => onLayerChange("supplier")}
            />
            <LayerChip
              label="Ports"
              active={activeLayer === "port"}
              onClick={() => onLayerChange("port")}
            />
            <LayerChip
              label="Climate"
              active={activeLayer === "climate"}
              onClick={() => onLayerChange("climate")}
            />
            <LayerChip
              label="Geo"
              active={activeLayer === "geo"}
              onClick={() => onLayerChange("geo")}
            />
            <LayerChip
              label="Logistics"
              active={activeLayer === "logistics"}
              onClick={() => onLayerChange("logistics")}
            />
          </div>

          <div className="relative z-0 flex-1 min-h-0 rounded-2xl overflow-hidden">
            <WorldRiskMap
              alerts={alerts}
              selectedAlertId={selectedAlert?.id ?? null}
              onSelectAlert={onSelectAlert}
            />
          </div>

          <div className="relative z-20 flex gap-3 flex-wrap">
            <Legend
              color="bg-cyan-400"
              label="Stable"
              active={activeLevel === "stable"}
              onClick={() =>
                onLevelChange(activeLevel === "stable" ? "all" : "stable")
              }
            />
            <Legend
              color="bg-amber-400"
              label="Warning"
              active={activeLevel === "warning"}
              onClick={() =>
                onLevelChange(activeLevel === "warning" ? "all" : "warning")
              }
            />
            <Legend
              color="bg-rose-400"
              label="Critical"
              active={activeLevel === "critical"}
              onClick={() =>
                onLevelChange(activeLevel === "critical" ? "all" : "critical")
              }
            />
          </div>
        </div>
      </Panel>

      <div className="xl:col-span-4 space-y-4">
        <Panel title="Live Alerts Feed">
          <div className="h-55 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                active={selectedAlert?.id === alert.id}
                onClick={() => onSelectAlert(alert)}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Emerging Risk Signals">
  <div className="grid grid-cols-2 gap-3">
    {emergingSignals.map((signal) => (
      <MiniStat
        key={signal.id}
        label={signal.label}
        value={signal.value}
        trend={signal.trend}
      />
    ))}
  </div>
</Panel>
      </div>
    </div>
  );
}