"use client";

import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import Panel from "@/components/dashboard/Panel";

export default function SettingsPage() {
  return (
    <PageShell
      header={
        <PageHeader
          title="Settings"
          description="Configure system behavior, alert thresholds, and data sources."
        />
      }
    >
      <PageSection>

        <Panel title="Risk Configuration">
          <div className="space-y-4">
            <SettingRow label="Critical Risk Threshold">
              <input type="number" defaultValue={70} className="input" />
            </SettingRow>

            <SettingRow label="Warning Risk Threshold">
              <input type="number" defaultValue={40} className="input" />
            </SettingRow>

            <SettingRow label="Max Acceptable Delay (hrs)">
              <input type="number" defaultValue={24} className="input" />
            </SettingRow>
          </div>
        </Panel>

        {/* 🔹 Notifications */}
        <Panel title="Notifications">
          <div className="space-y-4">
            <Toggle label="Enable Alerts" defaultChecked />
            <Toggle label="Critical Alerts Only" />
            <Toggle label="Email Notifications (future)" />
          </div>
        </Panel>

        {/* 🔹 Data Sources */}
        <Panel title="Data Sources">
          <div className="space-y-4">
            <Toggle label="Weather API" defaultChecked />
            <Toggle label="Geopolitical News Feed" defaultChecked />
            <Toggle label="Supplier Data Sync" defaultChecked />
            <Toggle label="Logistics Feed" defaultChecked />
          </div>
        </Panel>

        {/* 🔹 Display */}
        <Panel title="Display Preferences">
          <div className="space-y-4">
            <SettingRow label="Default Region">
              <select className="input">
                <option>Global</option>
                <option>Asia</option>
                <option>Europe</option>
              </select>
            </SettingRow>

            <SettingRow label="Default Time Range">
              <select className="input">
                <option>Last 24h</option>
                <option>Last 7 days</option>
              </select>
            </SettingRow>
          </div>
        </Panel>

        {/* 🔹 System Info */}
        <Panel title="System Info">
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="text-white">v1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync</span>
              <span className="text-white">5 min ago</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="text-emerald-400">Operational</span>
            </div>
          </div>
        </Panel>

      </PageSection>
    </PageShell>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  defaultChecked = false,
}: {
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-300">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="toggle" />
    </label>
  );
}