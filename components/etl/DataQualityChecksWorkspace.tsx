"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisRunControls } from "@/components/etl/AnalysisRunControls";
import { GapsPanel } from "@/components/etl/GapsPanel";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize, type AnalysisSnapshot } from "@/lib/etl/analysis";
import type { ExecutionSnapshot } from "@/lib/etl/execution";
import type { SqlSnapshot, ValidationScript } from "@/lib/etl/sql";

export function DataQualityChecksWorkspace() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkType, setCheckType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [scripts, setScripts] = useState<ValidationScript[]>([]);
  const [execution, setExecution] = useState<ExecutionSnapshot | null>(null);

  async function loadAnalysis() {
    setLoading(true);
    setError("");

    try {
      const [response, scriptResponse, executionResponse] = await Promise.all([
        fetch("/api/etl/analysis", { cache: "no-store" }),
        fetch("/api/etl/sql/scripts", { cache: "no-store" }),
        fetch("/api/etl/execution/runs", { cache: "no-store" }),
      ]);
      const result = (await response.json()) as AnalysisSnapshot & { success: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Data quality checks could not be loaded.");
      setSnapshot(result);
      if (scriptResponse.ok) {
        const scriptResult = (await scriptResponse.json()) as SqlSnapshot & { success: boolean };
        if (scriptResult.success) setScripts(scriptResult.scripts ?? []);
      }
      if (executionResponse.ok) {
        const executionResult = (await executionResponse.json()) as ExecutionSnapshot & { success: boolean };
        if (executionResult.success) setExecution(executionResult);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data quality checks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const checks = useMemo(() => {
    return (snapshot?.dataQualityChecks ?? []).filter((check) => {
      if (checkType !== "all" && check.check_type !== checkType) return false;
      if (severity !== "all" && check.severity !== severity) return false;
      return true;
    });
  }, [snapshot, checkType, severity]);

  const allChecks = snapshot?.dataQualityChecks ?? [];
  const summaryItems = [
    { label: "Total checks", value: allChecks.length, accent: "blue" as const },
    { label: "Null checks", value: allChecks.filter((item) => item.check_type === "null_check").length, accent: "orange" as const },
    { label: "Duplicate checks", value: allChecks.filter((item) => item.check_type === "duplicate_check").length, accent: "red" as const },
    { label: "Key integrity", value: allChecks.filter((item) => item.check_type?.includes("key")).length, accent: "teal" as const },
    { label: "Reconciliation", value: allChecks.filter((item) => item.check_type?.includes("reconciliation") || item.check_type === "row_count").length, accent: "green" as const },
    { label: "Domain/range", value: allChecks.filter((item) => item.check_type === "domain_value_check" || item.check_type === "range_check").length, accent: "blue" as const },
  ];

  return (
    <div className="space-y-5">
      <Header title="Data Quality Checks" description="Review extracted null, duplicate, referential integrity, key, range, and reconciliation checks." />
      <AnalysisRunControls onComplete={loadAnalysis} />
      {error ? <Alert message={error} /> : null}
      <SummaryCards items={summaryItems} />

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-text">Extracted Data Quality Checks</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={checkType} onChange={setCheckType} options={["all", "null_check", "duplicate_check", "format_check", "range_check", "referential_integrity", "primary_key_integrity", "row_count", "sum_reconciliation", "amount_reconciliation", "date_validation", "domain_value_check", "transformation_output_check"]} />
            <Select value={severity} onChange={setSeverity} options={["all", "critical", "high", "medium", "low"]} />
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-brand-secondary">Loading data quality checks...</p>
        ) : checks.length === 0 ? (
          <EmptyState message="No data quality checks extracted yet. Run AI analysis to detect null, duplicate, key, and reconciliation checks." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
                <tr>
                  {["Check Type", "Table", "Column", "Description", "Expected Condition", "Generated SQL", "Execution", "Evidence", "Severity", "Confidence", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/70">
                {checks.map((check) => {
                  const linkedScript = findLinkedScript(scripts, check.table_name, check.column_name, check.check_type);
                  const linkedResult = linkedScript ? execution?.results.find((result) => result.script_id === linkedScript.id && result.status !== "not_run") : null;
                  const evidenceCount = linkedResult ? execution?.evidence.filter((item) => item.execution_result_id === linkedResult.id).length ?? 0 : 0;
                  return (
                    <tr key={check.id} className="text-brand-secondary transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3">{labelize(check.check_type)}</td>
                      <td className="px-4 py-3 text-brand-text">{check.table_name || "-"}</td>
                      <td className="px-4 py-3">{check.column_name || "-"}</td>
                      <td className="max-w-sm truncate px-4 py-3">{check.description || "-"}</td>
                      <td className="max-w-xs truncate px-4 py-3">{check.expected_condition || "-"}</td>
                      <td className="px-4 py-3">{linkedScript ? <span className="text-brand-success">{linkedScript.script_name}</span> : <span className="text-brand-warning">Not generated</span>}</td>
                      <td className="px-4 py-3">{linkedResult ? <StatusBadge label={labelize(linkedResult.status)} tone={linkedResult.status === "passed" ? "success" : linkedResult.status === "failed" ? "danger" : "warning"} /> : <span className="text-brand-muted">Not run</span>}</td>
                      <td className="px-4 py-3">{evidenceCount}</td>
                      <td className="px-4 py-3">{labelize(check.severity)}</td>
                      <td className="px-4 py-3 font-semibold text-brand-teal">{check.confidence_score ?? 0}%</td>
                      <td className="px-4 py-3">
                        {linkedScript ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void navigator.clipboard.writeText(linkedScript.sql_text)} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold text-[#7AA7FF] hover:bg-brand-primary/10">Copy</button>
                            <button type="button" onClick={() => downloadSql(linkedScript)} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold text-[#7AA7FF] hover:bg-brand-primary/10">Download</button>
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GapsPanel gaps={snapshot?.gaps ?? []} />
    </div>
  );
}

function findLinkedScript(scripts: ValidationScript[], tableName?: string | null, columnName?: string | null, checkType?: string | null) {
  const category = checkType === "primary_key_integrity" ? "primary_key_integrity" : checkType;
  return scripts.find((script) => {
    if (category && script.validation_category !== category) return false;
    if (tableName && script.target_table !== tableName && script.source_table !== tableName) return false;
    if (columnName && script.target_column !== columnName && script.source_column !== columnName) return false;
    return true;
  });
}

function downloadSql(script: ValidationScript) {
  const blob = new Blob([script.sql_text], { type: "application/sql" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${script.script_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.sql`;
  link.click();
  URL.revokeObjectURL(url);
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
