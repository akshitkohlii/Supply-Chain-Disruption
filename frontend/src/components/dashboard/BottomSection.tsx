
"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "./Panel";
import AIMitigationEngine from "./AIMitigationEngine";
import MitigationScenarioComparison from "./MitigationScenarioComparison";
import {
  mitigationRecommendations,
  type MitigationRecommendation,
} from "@/lib/dashboard-data";

type BottomSectionProps = {
  selectedAlertId: string | null;
};

export default function BottomSection({
  selectedAlertId,
}: BottomSectionProps) {
  const filteredRecommendations = useMemo(() => {
    if (!selectedAlertId) return [];
    return mitigationRecommendations.filter(
      (item) => item.alertId === selectedAlertId
    );
  }, [selectedAlertId]);

  const hasRecommendations = filteredRecommendations.length > 0;

  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  useEffect(() => {
    if (hasRecommendations) {
      setSelectedRecommendationId(filteredRecommendations[0].id);
    } else {
      setSelectedRecommendationId(null);
    }
  }, [filteredRecommendations, hasRecommendations]);

  const selectedRecommendation = useMemo<MitigationRecommendation | null>(() => {
    if (!hasRecommendations) return null;

    return (
      filteredRecommendations.find(
        (item) => item.id === selectedRecommendationId
      ) ?? filteredRecommendations[0] ?? null
    );
  }, [filteredRecommendations, selectedRecommendationId, hasRecommendations]);

  if (!selectedAlertId) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <CollapsedCard
          title="Mitigation Scenario Comparison"
          className="xl:col-span-7"
          message="Select an alert to compare mitigation outcomes."
        />
        <CollapsedCard
          title="AI Mitigation & Recommendation Engine"
          className="xl:col-span-5"
          message="Select an alert to view AI recommendations."
        />
      </div>
    );
  }

  if (!hasRecommendations) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <CollapsedCard
          title="Mitigation Scenario Comparison"
          className="xl:col-span-7"
          message="No mitigation scenarios available for the selected alert."
        />
        <CollapsedCard
          title="AI Mitigation & Recommendation Engine"
          className="xl:col-span-5"
          message="No AI recommendations available for the selected alert."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Panel
        title="Mitigation Scenario Comparison"
        className="xl:col-span-7 h-180"
        bodyClassName="h-[calc(100%-65px)]"
      >
        <MitigationScenarioComparison recommendation={selectedRecommendation} />
      </Panel>

      <Panel
        title="AI Mitigation & Recommendation Engine"
        className="xl:col-span-5 h-180"
        bodyClassName="h-[calc(100%-65px)] overflow-y-auto pr-2 custom-scrollbar"
      >
        <AIMitigationEngine
          recommendations={filteredRecommendations}
          selectedRecommendationId={selectedRecommendationId}
          onSimulate={(recommendation) =>
            setSelectedRecommendationId(recommendation.id)
          }
        />
      </Panel>
    </div>
  );
}

function CollapsedCard({
  title,
  message,
  className = "",
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-slate-950/45 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.30)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100 md:text-base">
          {title}
        </h2>
        <div className="h-2 w-2 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.2)]" />
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 p-4 text-sm text-slate-400">
          {message}
        </div>
      </div>
    </div>
  );
}
