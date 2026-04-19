"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ApiSupplierPrediction } from "@/lib/api";

type SupplierMlRailProps = {
  prediction: ApiSupplierPrediction | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
};

function getPredictionBadge(label?: "stable" | "warning" | "critical") {
  if (label === "critical") {
    return "border-rose-400/20 bg-rose-500/10 text-rose-300";
  }
  if (label === "warning") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-300";
  }
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
}

function getBarColor(value: number) {
  if (value >= 80) return "bg-rose-500";
  if (value >= 60) return "bg-amber-400";
  return "bg-cyan-400";
}

export default function SupplierMlRail({
  prediction,
  isOpen,
  onClose,
  isLoading = false,
  error = null,
}: SupplierMlRailProps) {
  if (!isOpen) return null;

  return (
    <aside className="w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={prediction?.supplier_id ?? "supplier-rail"}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="sticky top-4"
        >
          <div className="relative h-[39.25rem] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="relative flex h-full flex-col">
              <div className="shrink-0 border-b border-slate-800/80 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Supplier Context
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      ML Supplier Prediction
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
                    aria-label="Close supplier panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {isLoading ? (
                  <div className="text-sm text-slate-400">
                    Loading supplier ML prediction...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                    {error}
                  </div>
                ) : !prediction ? (
                  <div className="text-sm text-slate-400">
                    Select a supplier to view ML details.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-white">
                            {prediction.supplier_name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {prediction.supplier_id}
                          </p>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getPredictionBadge(
                            prediction.predicted_label
                          )}`}
                        >
                          {prediction.predicted_label}
                        </span>
                      </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Risk Score
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {prediction.supplier_risk_score}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Predicted Delay
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {prediction.predicted_delay_hours.toFixed(1)}h
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Disruption Probability
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-500">Probability</span>
                          <span className="font-medium text-white">
                            {Math.round(prediction.disruption_probability * 100)}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                          <div
                            className={`h-full rounded-full ${getBarColor(
                              prediction.supplier_risk_score
                            )}`}
                            style={{ width: `${prediction.supplier_risk_score}%` }}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Supplier Features
                      </div>

                      <div className="mt-4 space-y-3 text-xs text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Country</span>
                          <span className="font-medium text-white">
                            {prediction.features.supplier_country}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Region</span>
                          <span className="font-medium text-white">
                            {prediction.features.supplier_region}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Business Unit</span>
                          <span className="font-medium text-white">
                            {prediction.features.business_unit}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Shipments</span>
                          <span className="font-medium text-white">
                            {prediction.features.shipment_count}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Avg Delay</span>
                          <span className="font-medium text-white">
                            {prediction.features.avg_delay_hours}h
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Customs Delay</span>
                          <span className="font-medium text-white">
                            {prediction.features.avg_customs_clearance_hours}h
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Inventory Ratio</span>
                          <span className="font-medium text-white">
                            {prediction.features.inventory_ratio}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Avg Route Risk</span>
                          <span className="font-medium text-white">
                            {prediction.features.avg_route_risk}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Top Factors
                      </div>

                      <div className="mt-4 space-y-2">
                        {prediction.top_factors.map((factor, index) => (
                          <div
                            key={`${factor}-${index}`}
                            className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-3 py-2 text-xs text-slate-200"
                          >
                            {factor}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}