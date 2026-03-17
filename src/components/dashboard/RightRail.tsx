import { ChevronDown } from "lucide-react";
import GlassBox from "./GlassBox";
import Panel from "./Panel";
import SidePlaceholder from "./ui/SidePlaceholder";

export default function RightRail() {
  return (
    <aside className="space-y-4">
      <GlassBox className="h-14 px-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">Context Panel</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </GlassBox>

      <Panel title="Selected Entity Details">
        <SidePlaceholder />
      </Panel>

      <Panel title="Root Cause Breakdown">
        <SidePlaceholder />
      </Panel>

      <Panel title="Impact Scope & Actions">
        <SidePlaceholder />
      </Panel>
    </aside>
  );
}
