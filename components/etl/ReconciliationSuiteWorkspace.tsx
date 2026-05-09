"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Route, Scale } from "lucide-react";
import { SqlCodeViewer } from "@/components/etl/SqlCodeViewer";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize } from "@/lib/etl/analysis";
import type { ExecutionSnapshot } from "@/lib/etl/execution";
import type { SqlSnapshot } from "@/lib/etl/sql";

export function ReconciliationSuiteWorkspace() {
  const [snapshot, setSnapshot] = useState<SqlSnapshot | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [execution, setExecution] = useState<ExecutionSnapshot | null>(null);

  useEffect(() => {
    async function loadScripts() {
      try {
        const [response, executionResponse] = await Promise.all([
          fetch("/api/etl/sql/scripts", { cache: "no-store" }),
          fetch("/api/etl/execution/runs", { cache: "no-store" }),
        ]);
        const result = (await response.json()) as SqlSnapshot & { success: boolean; error?: string };
        if (!response.ok || !result.success) throw new Error(result.error ?? "Reconciliation scripts could not be loaded.");
        setSnapshot(result);
        if (executionResponse.ok) {
          const executionResult = (await executionResponse.json()) as ExecutionSnapshot & { success: boolean };
          if (executionResult.success) setExecution(executionResult);
        }
        const firstRecon = result.scripts.find((script) => ["row_count", "sum_reconciliation", "amount_reconciliation"].includes(script.validation_category));
        setSelectedScriptId(firstRecon?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Reconciliation scripts could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void loadScripts();
  }, []);

  const reconciliationScripts = useMemo(() => (snapshot?.scripts ?? []).filter((script) => {
    const isRecon = ["row_count", "sum_reconciliation", "amount_reconciliation", "audit_balance"].includes(script.validation_category);
    if (!isRecon) return false;
    if (category !== "all" && script.validation_category !== category) return false;
    return true;
  }), [snapshot, category]);
  const selectedScript = reconciliationScripts.find((script) => script.id === selectedScriptId) ?? reconciliationScripts[0] ?? null;

  const ready = reconciliationScripts.filter((script) => script.execution_status === "ready").length;
  const needsReview = reconciliationScripts.filter((script) => (script.confidence_score ?? 100) < 70).length;
  const highSeverity = reconciliationScripts.filter((script) => (script.confidence_score ?? 100) >= 80).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">Phase 4</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">Reconciliation Suite</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">Row count, sum, amount, control total, missing target, and extra target validation scenarios.</p>
      </section>

      {error ? <Alert message={error} /> : null}
      <SummaryCards items={[
        { label: "Total reconciliation", value: reconciliationScripts.length, accent: "blue" as const },
        { label: "Ready for execution", value: ready, accent: "green" as const },
        { label: "Needs mapping review", value: needsReview, accent: "orange" as const },
        { label: "High confidence", value: highSeverity, accent: "teal" as const },
      ]} />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["all", "All"],
          ["row_count", "Row Count"],
          ["sum_reconciliation", "Sum/Amount"],
          ["audit_balance", "Control Total"],
          ["custom", "Missing in Target"],
          ["amount_reconciliation", "Extra in Target"],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-2xl border p-4 text-left transition ${category === value ? "border-brand-primary bg-brand-primary/15 text-white" : "border-brand-border bg-brand-card/70 text-brand-secondary hover:text-white"}`}>
            <Scale className="h-5 w-5 text-[#7AA7FF]" />
            <p className="mt-2 text-sm font-semibold">{label}</p>
          </button>
        ))}
      </section>

      <div className="grid gap-5 2xl:grid-cols-[460px_1fr]">
        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <h2 className="text-base font-semibold text-brand-text">Reconciliation Scripts</h2>
          {loading ? (
            <p className="mt-5 text-sm text-brand-secondary">Loading reconciliation scripts...</p>
          ) : reconciliationScripts.length === 0 ? (
            <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-6 text-sm text-brand-secondary">No reconciliation scripts generated yet. Generate SQL from reconciliation rules first.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {reconciliationScripts.map((script) => (
                <button key={script.id} type="button" onClick={() => setSelectedScriptId(script.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedScript?.id === script.id ? "border-brand-primary bg-brand-primary/10" : "border-brand-border bg-brand-card/70 hover:border-brand-primary/50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-text">{script.script_name}</p>
                      <p className="mt-1 text-xs text-brand-secondary">{labelize(script.validation_category)}</p>
                    </div>
                    <StatusBadge label={labelize(findExecutionStatus(execution, script.id) ?? script.execution_status)} tone={findExecutionStatus(execution, script.id) === "failed" ? "danger" : findExecutionStatus(execution, script.id) === "passed" ? "success" : "ready"} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-brand-secondary">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-brand-success" /> {script.confidence_score ?? 0}%</span>
                    {(script.confidence_score ?? 100) < 70 ? <span className="inline-flex items-center gap-1 text-brand-warning"><AlertTriangle className="h-3 w-3" /> Review</span> : null}
                    <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" /> {script.source_table || "-"} → {script.target_table || "-"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
        <SqlCodeViewer script={selectedScript} emptyMessage="Select a reconciliation script to preview it." />
      </div>
    </div>
  );
}

function findExecutionStatus(snapshot: ExecutionSnapshot | null, scriptId: string) {
  return snapshot?.results.find((result) => result.script_id === scriptId && result.status !== "not_run")?.status ?? null;
}

function Alert({ message }: { message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}
