"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Panel from "@/components/dashboard/Panel";
import PageShell from "@/components/dashboard/PageShell";
import PageHeader from "@/components/dashboard/PageHeader";
import PageSection from "@/components/dashboard/PageSection";
import SupplierMlRail from "@/components/dashboard/SupplierMlRail";
import {
  getAllSuppliers,
  getSupplierMlPrediction,
  type ApiSupplierListItem,
  type ApiSupplierPrediction,
} from "@/lib/api";

type SupplierSort = "risk-desc" | "risk-asc" | "dependency-desc" | "dependency-asc";

function SupplierCard({
  supplier,
  selected,
  onClick,
}: {
  supplier: ApiSupplierListItem;
  selected?: boolean;
  onClick: () => void;
}) {
  const badgeClass =
    supplier.risk_band === "high"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-300"
      : supplier.risk_band === "medium"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
        : "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected
          ? "border-slate-600 bg-slate-900/70"
          : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {supplier.supplier_name}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {supplier.supplier_id} • {supplier.supplier_country}
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${badgeClass}`}
        >
          {supplier.risk_band}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
        <div>
          <div className="text-slate-500">Risk Score</div>
          <div className="mt-1 font-medium text-white">{supplier.risk_score}</div>
        </div>

        <div>
          <div className="text-slate-500">Dependency</div>
          <div className="mt-1 font-medium text-white">{supplier.dependency_score}</div>
        </div>

        <div>
          <div className="text-slate-500">Shipments</div>
          <div className="mt-1 font-medium text-white">{supplier.shipment_count}</div>
        </div>

        <div>
          <div className="text-slate-500">Avg Delay</div>
          <div className="mt-1 font-medium text-white">{supplier.avg_delay_hours}h</div>
        </div>
      </div>
    </button>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [selectedDistribution, setSelectedDistribution] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [sortBy, setSortBy] = useState<SupplierSort>("risk-desc");

  const [suppliers, setSuppliers] = useState<ApiSupplierListItem[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierPrediction, setSelectedSupplierPrediction] =
    useState<ApiSupplierPrediction | null>(null);
  const [supplierPredictionLoading, setSupplierPredictionLoading] = useState(false);
  const [supplierPredictionError, setSupplierPredictionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        setSuppliersLoading(true);
        setSuppliersError(null);

        const data = await getAllSuppliers();
        setSuppliers(data);
      } catch (err) {
        setSuppliersError(err instanceof Error ? err.message : "Failed to load suppliers");
      } finally {
        setSuppliersLoading(false);
      }
    }

    loadSuppliers();
  }, []);

  useEffect(() => {
    async function loadSupplierPrediction() {
      if (!selectedSupplierId) {
        setSelectedSupplierPrediction(null);
        setSupplierPredictionError(null);
        return;
      }

      try {
        setSupplierPredictionLoading(true);
        setSupplierPredictionError(null);

        const prediction = await getSupplierMlPrediction(selectedSupplierId);
        setSelectedSupplierPrediction(prediction);
      } catch (err) {
        setSelectedSupplierPrediction(null);
        setSupplierPredictionError(
          err instanceof Error ? err.message : "Failed to load supplier prediction"
        );
      } finally {
        setSupplierPredictionLoading(false);
      }
    }

    loadSupplierPrediction();
  }, [selectedSupplierId]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let data = suppliers.filter((s) =>
      [s.supplier_name, s.supplier_id, s.supplier_country, s.supplier_region]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    if (selectedDistribution === "high") {
      data = data.filter((s) => s.risk_band === "high");
    } else if (selectedDistribution === "medium") {
      data = data.filter((s) => s.risk_band === "medium");
    } else if (selectedDistribution === "low") {
      data = data.filter((s) => s.risk_band === "low");
    }

    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case "risk-desc":
          return b.risk_score - a.risk_score;
        case "risk-asc":
          return a.risk_score - b.risk_score;
        case "dependency-desc":
          return b.dependency_score - a.dependency_score;
        case "dependency-asc":
          return a.dependency_score - b.dependency_score;
        default:
          return 0;
      }
    });

    return data;
  }, [suppliers, search, selectedDistribution, sortBy]);

  const isRailOpen = !!selectedSupplierId;

  return (
    <PageShell
      header={
        <PageHeader
          title="Supplier Risk Overview"
          description="Browse all suppliers, filter by risk band, and open ML-based supplier intelligence in the side panel."
        />
      }
    >
      <PageSection>
        <div className="mt-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-180 xl:max-w-215">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier..."
                className="input h-12 min-w-55 rounded-2xl px-4"
              />
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:justify-end">
              <select
                value={selectedDistribution}
                onChange={(e) =>
                  setSelectedDistribution(
                    e.target.value as "all" | "high" | "medium" | "low"
                  )
                }
                className="input h-12 min-w-35 rounded-2xl px-4"
              >
                <option value="all">All Risk Bands</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SupplierSort)}
                className="input h-12 min-w-45 rounded-2xl px-4"
              >
                <option value="risk-desc">Risk (High → Low)</option>
                <option value="risk-asc">Risk (Low → High)</option>
                <option value="dependency-desc">Dependency (High → Low)</option>
                <option value="dependency-asc">Dependency (Low → High)</option>
              </select>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection>
        <div className="hidden items-start gap-6 xl:flex mt-4">
          <motion.div
            layout
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 flex-1"
          >
            <Panel title="Supplier Exposure Directory">
              {suppliersLoading ? (
                <div className="text-sm text-slate-400">Loading suppliers...</div>
              ) : suppliersError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                  {suppliersError}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredSuppliers.map((supplier) => (
                    <SupplierCard
                      key={supplier.supplier_id}
                      supplier={supplier}
                      selected={selectedSupplierId === supplier.supplier_id}
                      onClick={() => setSelectedSupplierId(supplier.supplier_id)}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            {isRailOpen && (
              <motion.div
                key="supplier-rail"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0 overflow-hidden"
              >
                <div className="w-[340px]">
                  <SupplierMlRail
                    prediction={selectedSupplierPrediction}
                    isOpen={isRailOpen}
                    onClose={() => setSelectedSupplierId(null)}
                    isLoading={supplierPredictionLoading}
                    error={supplierPredictionError}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="xl:hidden">
          <div className="space-y-4">
            <Panel title="All Suppliers">
              {suppliersLoading ? (
                <div className="text-sm text-slate-400">Loading suppliers...</div>
              ) : suppliersError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                  {suppliersError}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredSuppliers.map((supplier) => (
                    <SupplierCard
                      key={supplier.supplier_id}
                      supplier={supplier}
                      selected={selectedSupplierId === supplier.supplier_id}
                      onClick={() => setSelectedSupplierId(supplier.supplier_id)}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <SupplierMlRail
              prediction={selectedSupplierPrediction}
              isOpen={isRailOpen}
              onClose={() => setSelectedSupplierId(null)}
              isLoading={supplierPredictionLoading}
              error={supplierPredictionError}
            />
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
}
