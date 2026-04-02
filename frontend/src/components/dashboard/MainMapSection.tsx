import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Panel from "./Panel";
import LayerChip from "./ui/LayerChip";
import Legend from "./ui/Legend";
import AlertRow from "./ui/AlertRow";
import MiniStat from "./ui/MiniStat";
import WorldRiskMap from "./WorldriskMap";

import type { AlertItem } from "@/lib/mappers";
import { emergingSignals } from "@/lib/dashboard-data";

type LayerFilter =
  | "all"
  | "supplier"
  | "port"
  | "climate"
  | "geo"
  | "logistics";

type LevelFilter = "all" | "stable" | "warning" | "critical";

type MainMapSectionProps = {
  mapAlerts: AlertItem[];
  feedAlerts: AlertItem[];
  selectedAlert: AlertItem | null;
  onSelectAlert: (alert: AlertItem | null) => void;
  activeLayer: LayerFilter;
  onLayerChange: (layer: LayerFilter) => void;
  activeLevel: LevelFilter;
  onLevelChange: (level: LevelFilter) => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
};

function MainMapSection({
  mapAlerts = [],
  feedAlerts = [],
  selectedAlert,
  onSelectAlert,
  activeLayer,
  onLayerChange,
  activeLevel,
  onLevelChange,
  onAcknowledge,
  onResolve,
}: MainMapSectionProps) {
  const orderedAlerts = useMemo(() => {
    if (!selectedAlert) return feedAlerts;

    const selected = feedAlerts.find((a) => a.id === selectedAlert.id);
    if (!selected) return feedAlerts;

    return [selected, ...feedAlerts.filter((a) => a.id !== selected.id)];
  }, [feedAlerts, selectedAlert]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Panel title="Global Disruption Risk Map" className="xl:col-span-8">
        <div className="flex h-130 flex-col gap-3 rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,14,25,0.95))] p-4">
          <div className="relative z-20 flex flex-wrap gap-2">
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

          <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl">
            <WorldRiskMap
              alerts={mapAlerts}
              selectedAlertId={selectedAlert?.id ?? null}
              onSelectAlert={onSelectAlert}
            />
          </div>

          <div className="relative z-20 flex flex-wrap gap-3">
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

      <div className="space-y-4 xl:col-span-4">
        <Panel 
          title="Live Alerts Feed"
          action={
            <div className="flex h-5 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 text-[10px] font-medium text-cyan-300">
              {orderedAlerts.length} Alerts
            </div>
          }
        >
          <div className="custom-scrollbar h-55 space-y-3 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {orderedAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: 24,
                    scale: 0.96,
                    height: 0,
                    marginBottom: 0,
                  }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <AlertRow
                    alert={alert}
                    active={selectedAlert?.id === alert.id}
                    onClick={() => onSelectAlert(alert)}
                    onAcknowledge={onAcknowledge}
                    onResolve={onResolve}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
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

export default memo(MainMapSection);