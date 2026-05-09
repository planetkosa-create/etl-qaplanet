"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, FileCode2, ListChecks, SearchCheck } from "lucide-react";
import { SqlCodeViewer } from "@/components/etl/SqlCodeViewer";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize } from "@/lib/etl/analysis";
import type { SqlSnapshot, ValidationScript } from "@/lib/etl/sql";

export function OracleChecksWorkspace() {
  const [snapshot, setSnapshot] = useState<SqlSnapshot | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadScripts() {
      setLoading(true);
      try {
        const response = await fetch("/api/etl/sql/scripts?databaseType=oracle", { cache: "no-store" });
        const result = (await response.json()) as SqlSnapshot & { success: boolean; error?: string };
        if (!response.ok || !result.success) throw new Error(result.error ?? "Oracle checks could not be loaded.");
        setSnapshot(result);
        setSelectedScriptId(result.scripts[0]?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Oracle checks could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void loadScripts();
  }, []);

  const scripts = useMemo(() => snapshot?.scripts ?? [], [snapshot?.scripts]);
  const selectedScript = scripts.find((script) => script.id === selectedScriptId) ?? scripts[0] ?? null;
  const featureCounts = useMemo(() => ({
    nvl: scripts.filter((script) => /\bNVL\s*\(/i.test(script.sql_text)).length,
    trunc: scripts.filter((script) => /\bTRUNC\s*\(/i.test(script.sql_text)).length,
    minus: scripts.filter((script) => /\bMINUS\b/i.test(script.sql_text)).length,
    ready: scripts.filter((script) => script.execution_status === "ready").length,
  }), [scripts]);

  return (
    <div className="space-y-5">
      <Header />
      {error ? <Alert message={error} /> : null}
      <SummaryCards items={[
        { label: "Oracle Statements", value: scripts.length, accent: "red" as const },
        { label: "Uses NVL", value: featureCounts.nvl, accent: "teal" as const },
        { label: "Uses TRUNC", value: featureCounts.trunc, accent: "blue" as const },
        { label: "Uses MINUS", value: featureCounts.minus, accent: "orange" as const },
        { label: "PL/SQL-ready", value: featureCounts.ready, accent: "green" as const },
      ]} />

      <div className="grid gap-5 2xl:grid-cols-[1fr_520px]">
        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <h2 className="text-base font-semibold text-brand-text">Oracle-Specific Scripts</h2>
          {loading ? (
            <p className="mt-5 text-sm text-brand-secondary">Loading Oracle scripts...</p>
          ) : scripts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
                  <tr>
                    {["Script Name", "Category", "Source Table", "Target Table", "Oracle Feature", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/70">
                  {scripts.map((script) => (
                    <tr key={script.id} className="text-brand-secondary transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-semibold text-brand-text">{script.script_name}</td>
                      <td className="px-4 py-3">{labelize(script.validation_category)}</td>
                      <td className="px-4 py-3">{script.source_table || "-"}</td>
                      <td className="px-4 py-3">{script.target_table || "-"}</td>
                      <td className="px-4 py-3">{detectOracleFeature(script)}</td>
                      <td className="px-4 py-3"><StatusBadge label={labelize(script.execution_status)} tone="ready" /></td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSelectedScriptId(script.id)} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold text-[#7AA7FF] hover:bg-brand-primary/10">Preview</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <SqlCodeViewer script={selectedScript} emptyMessage="Generate Oracle SQL from the SQL Validator Generator to populate this page." />
      </div>
    </div>
  );
}

function Header() {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
      <span className="inline-flex rounded-full border border-brand-danger/30 bg-brand-danger/15 px-3 py-1 text-xs font-semibold text-[#FF9C9C]">Phase 4</span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">Oracle Checks</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">Oracle-specific validation checks with NVL, TRUNC date filters, MINUS comparisons, and bind variables.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[Database, SearchCheck, ListChecks, FileCode2].map((Icon, index) => (
          <div key={index} className="rounded-xl border border-brand-border bg-brand-card/70 p-3 text-brand-secondary">
            <Icon className="h-5 w-5 text-[#7AA7FF]" />
            <p className="mt-2 text-xs">{["Oracle syntax", "Safe SELECT checks", "Bind variables", "Execution-ready review"][index]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function detectOracleFeature(script: ValidationScript) {
  if (/\bNVL\s*\(/i.test(script.sql_text)) return "NVL null safety";
  if (/\bTRUNC\s*\(/i.test(script.sql_text)) return "TRUNC date filter";
  if (/\bMINUS\b/i.test(script.sql_text)) return "MINUS set difference";
  if (/:LOAD_DATE/i.test(script.sql_text)) return "Bind variable";
  return "Oracle SELECT";
}

function EmptyState() {
  return <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">No Oracle SQL has been generated yet. Generate validation SQL with Database Type set to Oracle.</div>;
}

function Alert({ message }: { message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}
