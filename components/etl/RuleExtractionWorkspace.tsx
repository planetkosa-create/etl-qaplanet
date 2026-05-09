"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisRunControls } from "@/components/etl/AnalysisRunControls";
import { GapsPanel } from "@/components/etl/GapsPanel";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize, type AnalysisSnapshot } from "@/lib/etl/analysis";

export function RuleExtractionWorkspace() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ruleType, setRuleType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [query, setQuery] = useState("");

  async function loadAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/etl/analysis", { cache: "no-store" });
      const result = (await response.json()) as AnalysisSnapshot & { success: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Rules could not be loaded.");
      setSnapshot(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Rules could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const rules = useMemo(() => {
    const search = query.toLowerCase();
    return (snapshot?.rules ?? []).filter((rule) => {
      if (ruleType !== "all" && rule.rule_type !== ruleType) return false;
      if (severity !== "all" && rule.severity !== severity) return false;
      if (confidence === "low" && (rule.confidence_score ?? 0) >= 70) return false;
      if (search && ![rule.title, rule.description, ...(rule.affected_tables ?? []), ...(rule.affected_columns ?? [])].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [snapshot, ruleType, severity, confidence, query]);

  const allRules = snapshot?.rules ?? [];
  const summaryItems = [
    { label: "Transformation", value: allRules.filter((rule) => rule.rule_type === "transformation").length, accent: "teal" as const },
    { label: "Join", value: allRules.filter((rule) => rule.rule_type === "join").length, accent: "blue" as const },
    { label: "Null handling", value: allRules.filter((rule) => rule.rule_type === "null_handling").length, accent: "orange" as const },
    { label: "Aggregation", value: allRules.filter((rule) => rule.rule_type === "aggregation").length, accent: "green" as const },
    { label: "Reconciliation", value: allRules.filter((rule) => rule.rule_type === "reconciliation").length, accent: "blue" as const },
    { label: "Business constraints", value: allRules.filter((rule) => rule.rule_type === "business_constraint").length, accent: "red" as const },
  ];

  return (
    <div className="space-y-5">
      <Header title="Rule Extraction" description="Extract transformation, join, aggregation, reconciliation, null-handling, and business rules." />
      <AnalysisRunControls onComplete={loadAnalysis} />
      {error ? <Alert message={error} /> : null}
      <SummaryCards items={summaryItems} />

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-text">Extracted ETL Rules</h2>
          <div className="flex flex-wrap gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Table or column" className="rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal" />
            <Select value={ruleType} onChange={setRuleType} options={["all", "transformation", "join", "filter", "null_handling", "aggregation", "reconciliation", "duplicate_check", "primary_key", "foreign_key", "data_quality", "business_constraint", "audit", "other"]} />
            <Select value={severity} onChange={setSeverity} options={["all", "critical", "high", "medium", "low"]} />
            <Select value={confidence} onChange={setConfidence} options={["all", "low"]} />
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-brand-secondary">Loading extracted rules...</p>
        ) : rules.length === 0 ? (
          <EmptyState message="No ETL rules extracted yet. Run AI analysis to identify transformation, join, reconciliation, and data quality rules." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
                <tr>
                  {["Rule Reference", "Rule Type", "Title", "Description", "Validation Intent", "Severity", "Confidence", "Affected Tables", "Affected Columns"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/70">
                {rules.map((rule) => (
                  <tr key={rule.id} className="text-brand-secondary transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-semibold text-brand-text">{rule.rule_reference || "-"}</td>
                    <td className="px-4 py-3">{labelize(rule.rule_type)}</td>
                    <td className="px-4 py-3 text-brand-text">{rule.title || "-"}</td>
                    <td className="max-w-sm truncate px-4 py-3">{rule.description || "-"}</td>
                    <td className="max-w-xs truncate px-4 py-3">{rule.validation_intent || "-"}</td>
                    <td className="px-4 py-3">{labelize(rule.severity)}</td>
                    <td className="px-4 py-3 font-semibold text-brand-teal">{rule.confidence_score ?? 0}%</td>
                    <td className="px-4 py-3">{rule.affected_tables?.join(", ") || "-"}</td>
                    <td className="px-4 py-3">{rule.affected_columns?.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GapsPanel gaps={snapshot?.gaps ?? []} />
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

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-sm text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal">
      {options.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
    </select>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">{message}</div>;
}

function Alert({ message }: { message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}
