"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AnalysisRunControls } from "@/components/etl/AnalysisRunControls";
import { GapsPanel } from "@/components/etl/GapsPanel";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize, type AnalysisSnapshot, type MappingItem } from "@/lib/etl/analysis";

export function MappingAnalysisWorkspace() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mappingType, setMappingType] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [required, setRequired] = useState("all");
  const [keyOnly, setKeyOnly] = useState("all");
  const [selected, setSelected] = useState<MappingItem | null>(null);

  async function loadAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/etl/analysis", { cache: "no-store" });
      const result = (await response.json()) as AnalysisSnapshot & { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Analysis data could not be loaded.");
      }

      setSnapshot(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analysis data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const mappings = useMemo(() => {
    return (snapshot?.mappings ?? []).filter((item) => {
      if (mappingType !== "all" && item.mapping_type !== mappingType) return false;
      if (confidence === "low" && (item.confidence_score ?? 0) >= 70) return false;
      if (required !== "all" && item.is_required !== (required === "yes")) return false;
      if (keyOnly !== "all" && item.is_key !== (keyOnly === "yes")) return false;
      return true;
    });
  }, [snapshot, mappingType, confidence, required, keyOnly]);

  const summaryItems = [
    { label: "Total mappings", value: snapshot?.mappings.length ?? 0, accent: "blue" as const },
    { label: "Direct mappings", value: snapshot?.mappings.filter((item) => item.mapping_type === "direct").length ?? 0, accent: "green" as const },
    { label: "Transformed", value: snapshot?.mappings.filter((item) => item.mapping_type === "transformed" || item.mapping_type === "derived").length ?? 0, accent: "teal" as const },
    { label: "Joined", value: snapshot?.mappings.filter((item) => item.mapping_type === "joined").length ?? 0, accent: "orange" as const },
    { label: "Key fields", value: snapshot?.mappings.filter((item) => item.is_key).length ?? 0, accent: "blue" as const },
    { label: "Low confidence", value: snapshot?.mappings.filter((item) => (item.confidence_score ?? 0) < 70).length ?? 0, accent: "red" as const },
  ];

  return (
    <div className="space-y-5">
      <Header title="Mapping Analysis" description="Analyze source-to-target mappings and detect missing coverage." />
      <AnalysisRunControls onComplete={loadAnalysis} />
      {error ? <Alert tone="danger" message={error} /> : null}
      <SummaryCards items={summaryItems} />

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-text">Extracted Source-to-Target Mappings</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={mappingType} onChange={setMappingType} options={["all", "direct", "transformed", "derived", "aggregated", "joined", "lookup", "constant", "excluded", "unknown"]} />
            <Select value={confidence} onChange={setConfidence} options={["all", "low"]} />
            <Select value={required} onChange={setRequired} options={["all", "yes", "no"]} labelPrefix="Required" />
            <Select value={keyOnly} onChange={setKeyOnly} options={["all", "yes", "no"]} labelPrefix="Key" />
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-brand-secondary">Loading mapping analysis...</p>
        ) : mappings.length === 0 ? (
          <EmptyState message="No mappings extracted yet. Upload ETL artifacts and run AI analysis." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
                <tr>
                  {["Source Table", "Source Column", "Target Table", "Target Column", "Mapping Type", "Transformation Rule", "Join Condition", "Required", "Key", "Confidence"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/70">
                {mappings.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item)} className="cursor-pointer text-brand-secondary transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-brand-text">{item.source_table || "-"}</td>
                    <td className="px-4 py-3">{item.source_column || "-"}</td>
                    <td className="px-4 py-3 text-brand-text">{item.target_table || "-"}</td>
                    <td className="px-4 py-3">{item.target_column || "-"}</td>
                    <td className="px-4 py-3">{labelize(item.mapping_type)}</td>
                    <td className="max-w-xs truncate px-4 py-3">{item.transformation_rule || "-"}</td>
                    <td className="max-w-xs truncate px-4 py-3">{item.join_condition || "-"}</td>
                    <td className="px-4 py-3">{item.is_required ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{item.is_key ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 font-semibold text-brand-teal">{item.confidence_score ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GapsPanel gaps={snapshot?.gaps ?? []} />
      <MappingDrawer mapping={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function MappingDrawer({ mapping, onClose }: { mapping: MappingItem | null; onClose: () => void }) {
  if (!mapping) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-brand-border bg-brand-background p-5 shadow-panel-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{labelize(mapping.mapping_type)}</p>
            <h2 className="mt-1 text-xl font-bold text-brand-text">{mapping.source_column || "Source"} → {mapping.target_column || "Target"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-brand-secondary hover:bg-brand-card hover:text-white" aria-label="Close mapping details">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4 overflow-y-auto text-sm">
          <Detail label="Source" value={`${mapping.source_system || "-"} / ${mapping.source_table || "-"} / ${mapping.source_column || "-"}`} />
          <Detail label="Target" value={`${mapping.target_system || "-"} / ${mapping.target_table || "-"} / ${mapping.target_column || "-"}`} />
          <Detail label="Data Type" value={mapping.data_type} />
          <Detail label="Business Rule" value={mapping.business_rule} />
          <Detail label="Transformation Rule" value={mapping.transformation_rule} />
          <Detail label="Join Condition" value={mapping.join_condition} />
          <Detail label="Filter Condition" value={mapping.filter_condition} />
          <Detail label="Confidence" value={`${mapping.confidence_score ?? 0}%`} />
        </div>
      </div>
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
      <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">Phase 3</span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">{description}</p>
    </section>
  );
}

function Select({ value, onChange, options, labelPrefix }: { value: string; onChange: (value: string) => void; options: string[]; labelPrefix?: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-sm text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal">
      {options.map((option) => (
        <option key={option} value={option}>{labelPrefix ? `${labelPrefix}: ` : ""}{labelize(option)}</option>
      ))}
    </select>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{label}</p>
      <p className="mt-2 leading-6 text-brand-text">{value || "Not specified"}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">{message}</div>;
}

function Alert({ message }: { tone: "danger"; message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}
