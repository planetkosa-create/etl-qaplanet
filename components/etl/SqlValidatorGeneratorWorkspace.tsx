"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Code2, Database, Download, PackageCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { SqlCodeViewer } from "@/components/etl/SqlCodeViewer";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { labelize } from "@/lib/etl/analysis";
import type { SqlSnapshot, ValidationPack, ValidationScript } from "@/lib/etl/sql";

const databaseOptions = ["oracle", "generic_sql", "sql_server", "postgres", "snowflake", "bigquery"];
const categoryOptions = [
  ["row_count", "Row Count"],
  ["sum_reconciliation", "Sum/Amount"],
  ["duplicate_check", "Duplicate"],
  ["null_check", "Null Handling"],
  ["primary_key_integrity", "Primary Key"],
  ["transformation_output", "Transformation"],
  ["join_validation", "Join Validation"],
  ["domain_value_check", "Data Quality"],
] as const;
const tabs = ["all", "sql", "oracle", "reconciliation", "data_quality"] as const;

type GenerateResponse = {
  success: boolean;
  error?: string;
  counts?: SqlSnapshot["counts"];
  scripts?: ValidationScript[];
  packs?: ValidationPack[];
};

export function SqlValidatorGeneratorWorkspace() {
  const [snapshot, setSnapshot] = useState<SqlSnapshot | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [databaseType, setDatabaseType] = useState("oracle");
  const [categories, setCategories] = useState<string[]>(["row_count", "duplicate_check", "null_check", "primary_key_integrity", "transformation_output"]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadScripts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/etl/sql/scripts", { cache: "no-store" });
      const result = (await response.json()) as SqlSnapshot & { success: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Generated SQL could not be loaded.");
      setSnapshot(result);
      setSelectedScriptId((current) => current || result.latestScript?.id || result.scripts[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Generated SQL could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadScripts();
  }, []);

  async function generateSql() {
    setGenerating(true);
    setError("");
    setMessage("Generating validation SQL...");

    try {
      const response = await fetch("/api/etl/sql/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseType, categories, mode: "selected" }),
      });
      const result = (await response.json()) as GenerateResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Validation SQL could not be generated.");
      setMessage(`Generated ${result.counts?.scripts ?? result.scripts?.length ?? 0} validation scripts and ${result.counts?.packs ?? result.packs?.length ?? 0} validation packs.`);
      await loadScripts();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Validation SQL could not be generated.");
      setMessage("");
    } finally {
      setGenerating(false);
    }
  }

  const scripts = useMemo(() => snapshot?.scripts ?? [], [snapshot?.scripts]);
  const filteredScripts = useMemo(() => {
    return scripts.filter((script) => {
      if (activeTab === "sql") return script.script_type === "sql" || script.database_type !== "oracle";
      if (activeTab === "oracle") return script.database_type === "oracle";
      if (activeTab === "reconciliation") return ["row_count", "sum_reconciliation", "amount_reconciliation"].includes(script.validation_category);
      if (activeTab === "data_quality") return script.script_type === "data_quality";
      return true;
    });
  }, [scripts, activeTab]);
  const selectedScript = scripts.find((script) => script.id === selectedScriptId) ?? filteredScripts[0] ?? null;

  const summaryItems = [
    { label: "Generated Scripts", value: snapshot?.counts.scripts ?? 0, accent: "blue" as const },
    { label: "Oracle Statements", value: snapshot?.counts.oracleStatements ?? 0, accent: "red" as const },
    { label: "Reconciliation", value: snapshot?.counts.reconciliationScripts ?? 0, accent: "green" as const },
    { label: "Data Quality", value: snapshot?.counts.dataQualityScripts ?? 0, accent: "teal" as const },
    { label: "Validation Packs", value: snapshot?.counts.packs ?? 0, accent: "orange" as const },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">Phase 4</span>
        <div className="mt-4 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-text">SQL Validator Generator</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">Generate SQL and Oracle validation statements from extracted ETL analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={databaseType} onChange={(event) => setDatabaseType(event.target.value)} className="rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal">
              {databaseOptions.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}
            </select>
            <button type="button" onClick={generateSql} disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric disabled:cursor-not-allowed disabled:opacity-60">
              {generating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate Validation SQL"}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {categoryOptions.map(([value, label]) => {
            const selected = categories.includes(value);
            return (
              <button key={value} type="button" onClick={() => setCategories((current) => selected ? current.filter((item) => item !== value) : [...current, value])} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${selected ? "border-brand-primary bg-brand-primary/20 text-white" : "border-brand-border bg-brand-card text-brand-secondary hover:text-white"}`}>
                {label}
              </button>
            );
          })}
        </div>
        {message ? <p className="mt-4 text-sm font-semibold text-brand-success">{message}</p> : null}
        {error ? <p className="mt-4 text-sm font-semibold text-brand-danger">{error}</p> : null}
      </section>

      <SummaryCards items={summaryItems} />

      <div className="grid gap-5 2xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === tab ? "bg-brand-primary text-white" : "bg-brand-card text-brand-secondary hover:text-white"}`}>
                {labelize(tab)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-brand-secondary">Loading generated scripts...</p>
          ) : filteredScripts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-4 max-h-[650px] space-y-3 overflow-auto pr-1">
              {filteredScripts.map((script) => (
                <button key={script.id} type="button" onClick={() => setSelectedScriptId(script.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedScript?.id === script.id ? "border-brand-primary bg-brand-primary/10" : "border-brand-border bg-brand-card/70 hover:border-brand-primary/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-text">{script.script_name}</p>
                      <p className="mt-1 text-xs text-brand-secondary">{labelize(script.validation_category)} • {labelize(script.database_type)}</p>
                    </div>
                    <StatusBadge label={labelize(script.execution_status)} tone={script.execution_status === "ready" ? "ready" : "neutral"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-brand-secondary">
                    {script.source_table ? <span>{script.source_table}</span> : null}
                    {script.target_table ? <span>→ {script.target_table}</span> : null}
                    <span>{script.confidence_score ?? 0}% confidence</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <SqlCodeViewer script={selectedScript} emptyMessage="No generated SQL yet. Choose categories and click Generate Validation SQL." />
      </div>

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-brand-teal" />
          <h2 className="text-base font-semibold text-brand-text">Generated Validation Packs</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(snapshot?.packs ?? []).map((pack) => (
            <article key={pack.id} className="rounded-xl border border-brand-border bg-brand-card/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-text">{pack.pack_name}</h3>
                  <p className="mt-1 text-xs text-brand-secondary">{pack.description}</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-brand-success" />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-brand-secondary">{labelize(pack.database_type)}</span>
                <span className="font-semibold text-brand-text">{pack.script_count} scripts</span>
              </div>
            </article>
          ))}
          {(snapshot?.packs.length ?? 0) === 0 ? <p className="text-sm text-brand-secondary">Validation packs will appear after SQL generation.</p> : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <QuickAction href="/oracle-checks" icon={<Database className="h-5 w-5" />} title="Oracle Checks" />
        <QuickAction href="/reconciliation-suite" icon={<CheckCircle2 className="h-5 w-5" />} title="Reconciliation Suite" />
        <QuickAction href="/export-center" icon={<Download className="h-5 w-5" />} title="Export Center" />
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-6 text-sm text-brand-secondary">
      No ETL analysis results found or no SQL has been generated yet. Run Mapping Analysis and Rule Extraction before generating validation SQL.
    </div>
  );
}

function QuickAction({ href, title, icon }: { href: string; title: string; icon: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-card/70 p-4 text-sm font-semibold text-brand-text transition hover:border-brand-primary hover:bg-brand-primary/10">
      <span className="text-[#7AA7FF]">{icon}</span>
      {title}
    </Link>
  );
}
