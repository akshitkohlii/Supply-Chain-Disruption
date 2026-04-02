"use client";

import { useEffect, useMemo, useState } from "react";
import AIMitigationEngine from "./AIMitigationEngine";
import MitigationScenarioComparison from "./MitigationScenarioComparison";
import Panel from "./Panel";
import { getMitigationPlan, type ApiMitigationPlan } from "@/lib/api";

type Scenario = {
  id: string;
  label: string;
  riskScore: number;
  delayHours: number;
  recoveryDays: number;
  costImpact: number;
};

type Recommendation = {
  id: string;
  alertId: string;
  title: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  impactReduction: number;
  reason: string;
  actions: string[];
  reroutePlan?: {
    from: string;
    to: string;
    etaSavingsHours: number;
  };
  stockPlan?: {
    supplier: string;
    skuGroup: string;
    currentDaysCover: number;
    recommendedDaysCover: number;
    increasePercent: number;
  };
  scenarios: Scenario[];
};

type BottomSectionProps = {
  selectedAlertId: string | null;
};

function mapMitigationPlanToUi(plan: ApiMitigationPlan): Recommendation {
  return {
    id: plan.id,
    alertId: plan.alert_id,
    title: plan.title,
    priority: plan.priority,
    confidence: plan.confidence,
    impactReduction: plan.impact_reduction,
    reason: plan.reason,
    actions: plan.actions,
    reroutePlan: plan.reroute_plan
      ? {
          from: plan.reroute_plan.from,
          to: plan.reroute_plan.to,
          etaSavingsHours: plan.reroute_plan.eta_savings_hours,
        }
      : undefined,
    stockPlan: plan.stock_plan
      ? {
          supplier: plan.stock_plan.supplier,
          skuGroup: plan.stock_plan.sku_group,
          currentDaysCover: plan.stock_plan.current_days_cover,
          recommendedDaysCover: plan.stock_plan.recommended_days_cover,
          increasePercent: plan.stock_plan.increase_percent,
        }
      : undefined,
    scenarios: plan.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      riskScore: scenario.risk_score,
      delayHours: scenario.delay_hours,
      recoveryDays: scenario.recovery_days,
      costImpact: scenario.cost_impact,
    })),
  };
}

export default function BottomSection({
  selectedAlertId,
}: BottomSectionProps) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMitigation() {
      if (!selectedAlertId) {
        setRecommendation(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await getMitigationPlan(selectedAlertId);

        if (!isCancelled) {
          setRecommendation(mapMitigationPlanToUi(response));
        }
      } catch (err) {
        if (!isCancelled) {
          setRecommendation(null);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load mitigation plan."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMitigation();

    return () => {
      isCancelled = true;
    };
  }, [selectedAlertId]);

  const scenarioData = useMemo(() => {
    return recommendation?.scenarios ?? [];
  }, [recommendation]);

  const panelHeightClass = selectedAlertId ? "h-[720px]" : "";
  const panelBodyClass = selectedAlertId ? "h-[calc(100%-57px)] min-h-0" : "";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8 min-h-0">
        <Panel
          title="Mitigation Scenario Comparison"
          className={panelHeightClass}
          bodyClassName={panelBodyClass}
        >
          <MitigationScenarioComparison
            recommendation={recommendation}
            scenarios={scenarioData}
            isLoading={isLoading}
            error={error}
            selectedAlertId={selectedAlertId}
          />
        </Panel>
      </div>

      <div className="xl:col-span-4 min-h-0">
        <Panel
          title="AI Mitigation & Recommendation Engine"
          className={panelHeightClass}
          bodyClassName={panelBodyClass}
        >
          <AIMitigationEngine
            recommendation={recommendation}
            isLoading={isLoading}
            error={error}
            selectedAlertId={selectedAlertId}
          />
        </Panel>
      </div>
    </div>
  );
}