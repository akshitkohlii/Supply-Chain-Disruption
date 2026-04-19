"use client";

import { useMemo, useRef, useState } from "react";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import Panel from "@/components/dashboard/Panel";
import { updateAlertThresholdSettings } from "@/lib/api";
import {
  DEFAULT_APP_SETTINGS,
  REGION_OPTIONS,
  TIME_RANGE_OPTIONS,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from "@/lib/settings";

export default function SettingsPage() {
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => loadAppSettings());
  const [draftSettings, setDraftSettings] = useState<AppSettings>(() => loadAppSettings());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  function updateSettings(updater: (current: AppSettings) => AppSettings) {
    setDraftSettings((current) => updater(current));
  }

  const operationalStatus = useMemo(() => {
    const activeFeeds = [
      draftSettings.weatherApiEnabled,
      draftSettings.newsFeedEnabled,
      draftSettings.supplierSyncEnabled,
      draftSettings.logisticsFeedEnabled,
    ].filter(Boolean).length;

    if (activeFeeds === 4) return "Operational";
    if (activeFeeds >= 2) return "Partial";
    return "Degraded";
  }, [draftSettings]);

  const hasUnsavedChanges =
    JSON.stringify(draftSettings) !== JSON.stringify(savedSettings);

  async function applyChanges() {
    setIsApplying(true);
    saveAppSettings(draftSettings);
    setSavedSettings(draftSettings);

    try {
      const result = await updateAlertThresholdSettings({
        criticalRiskThreshold: draftSettings.criticalRiskThreshold,
        warningRiskThreshold: draftSettings.warningRiskThreshold,
        regenerateAlerts: true,
      });

      const rebuiltAlerts = result.generation_result?.alerts_upserted;
      setSaveMessage(
        typeof rebuiltAlerts === "number"
          ? `Changes applied. ${rebuiltAlerts} alerts rebuilt in the database.`
          : "Changes applied and alerts rebuilt."
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? `Changes saved locally, but backend sync failed: ${error.message}`
          : "Changes saved locally, but backend sync failed."
      );
    } finally {
      setIsApplying(false);
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => setSaveMessage(null), 2200);
    }
  }

  function resetToDefaults() {
    setDraftSettings(DEFAULT_APP_SETTINGS);
    setSaveMessage("Defaults loaded. Apply changes to save them.");
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => setSaveMessage(null), 1800);
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Settings"
          description="Configure system behavior, alert thresholds, and saved app preferences."
        />
      }
    >
      <PageSection>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-4 py-3">
          <div className="text-sm text-slate-400">
            {saveMessage ??
              (hasUnsavedChanges
                ? "You have unapplied changes."
                : "Preferences persist locally after you apply them.")}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToDefaults}
              className="rounded-xl border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={applyChanges}
              disabled={!hasUnsavedChanges || isApplying}
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500"
            >
              {isApplying ? "Applying..." : "Apply Changes"}
            </button>
          </div>
        </div>

        <Panel title="Risk Threshold Controls">
          <div className="space-y-4">
            <SettingRow label="Critical Risk Threshold">
              <input
                type="number"
                value={draftSettings.criticalRiskThreshold}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    criticalRiskThreshold: Number(event.target.value || 0),
                  }))
                }
                className="input w-28"
              />
            </SettingRow>

            <SettingRow label="Warning Risk Threshold">
              <input
                type="number"
                value={draftSettings.warningRiskThreshold}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    warningRiskThreshold: Number(event.target.value || 0),
                  }))
                }
                className="input w-28"
              />
            </SettingRow>

            <SettingRow label="Max Acceptable Delay (hrs)">
              <input
                type="number"
                value={draftSettings.maxAcceptableDelayHours}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    maxAcceptableDelayHours: Number(event.target.value || 0),
                  }))
                }
                className="input w-28"
              />
            </SettingRow>
          </div>
        </Panel>

        <Panel title="Notification Preferences">
          <div className="space-y-4">
            <Toggle
              label="Enable Alerts"
              checked={draftSettings.enableAlerts}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, enableAlerts: checked }))
              }
            />
            <Toggle
              label="Critical Alerts Only"
              checked={draftSettings.criticalAlertsOnly}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, criticalAlertsOnly: checked }))
              }
            />
            <Toggle
              label="Email Notifications"
              checked={draftSettings.emailNotifications}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, emailNotifications: checked }))
              }
            />
          </div>
        </Panel>

        <Panel title="Data Source Controls">
          <div className="space-y-4">
            <Toggle
              label="Weather API"
              checked={draftSettings.weatherApiEnabled}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, weatherApiEnabled: checked }))
              }
            />
            <Toggle
              label="Geopolitical News Feed"
              checked={draftSettings.newsFeedEnabled}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, newsFeedEnabled: checked }))
              }
            />
            <Toggle
              label="Supplier Data Sync"
              checked={draftSettings.supplierSyncEnabled}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, supplierSyncEnabled: checked }))
              }
            />
            <Toggle
              label="Logistics Feed"
              checked={draftSettings.logisticsFeedEnabled}
              onChange={(checked) =>
                updateSettings((current) => ({ ...current, logisticsFeedEnabled: checked }))
              }
            />
          </div>
        </Panel>

        <Panel title="Display Defaults">
          <div className="space-y-4">
            <SettingRow label="User Region">
              <select
                value={draftSettings.defaultRegion}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    defaultRegion: event.target.value as AppSettings["defaultRegion"],
                  }))
                }
                className="input min-w-44"
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </SettingRow>

            <p className="text-xs text-slate-500">
              This sets the user&apos;s home region. It does not filter the dashboard
              by itself. The top scope switch uses this value when set to Regional.
            </p>

            <SettingRow label="Default Time Range">
              <select
                value={draftSettings.defaultTimeRange}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    defaultTimeRange: event.target.value as AppSettings["defaultTimeRange"],
                  }))
                }
                className="input min-w-44"
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Panel>

        <Panel title="System Status">
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>App Version</span>
              <span className="text-white">v1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>User Region</span>
              <span className="text-white">{savedSettings.defaultRegion}</span>
            </div>
            <div className="flex justify-between">
              <span>Saved Time Range</span>
              <span className="text-white">{savedSettings.defaultTimeRange}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span
                className={
                  operationalStatus === "Operational"
                    ? "text-emerald-400"
                    : operationalStatus === "Partial"
                    ? "text-amber-400"
                    : "text-rose-400"
                }
              >
                {operationalStatus}
              </span>
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
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="toggle"
      />
    </label>
  );
}
