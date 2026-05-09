"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileArchive, FileCode2, FileSpreadsheet, PackageCheck } from "lucide-react";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { labelize } from "@/lib/etl/analysis";
import type { SqlSnapshot, ValidationPack, ValidationScript } from "@/lib/etl/sql";

const exportOptions = [
  { value: "sql_file", label: "Export selected scripts as .sql", icon: FileCode2 },
  { value: "zip_package", label: "Export validation pack as ZIP", icon: FileArchive },
  { value: "csv_inventory", label: "Export script inventory CSV", icon: FileSpreadsheet },
  { value: "markdown_report", label: "Export markdown validation report", icon: PackageCheck },
] as const;

type ExportResponse = {
  success: boolean;
  error?: string;
  fileName?: string;
  fileContent?: string;
  contentType?: string;
  encoding?: "text" | "base64";
};

export function ExportCenterWorkspace() {
  const [snapshot, setSnapshot] = useState<SqlSnapshot | null>(null);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [exportType, setExportType] = useState<(typeof exportOptions)[number]["value"]>("sql_file");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadExportData() {
      try {
        const response = await fetch("/api/etl/sql/scripts", { cache: "no-store" });
        const result = (await response.json()) as SqlSnapshot & { success: boolean; error?: string };
        if (!response.ok || !result.success) throw new Error(result.error ?? "Export data could not be loaded.");
        setSnapshot(result);
        setSelectedPackId(result.packs[0]?.id ?? "");
        setSelectedScriptIds(result.scripts.slice(0, 5).map((script) => script.id));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Export data could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void loadExportData();
  }, []);

  async function exportScripts() {
    setExporting(true);
    setError("");
    setMessage("Preparing validation export...");

    try {
      const response = await fetch("/api/etl/sql/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportType,
          packId: exportType === "zip_package" ? selectedPackId || undefined : undefined,
          scriptIds: exportType !== "zip_package" ? selectedScriptIds : undefined,
        }),
      });
      const result = (await response.json()) as ExportResponse;
      if (!response.ok || !result.success || !result.fileContent || !result.fileName) {
        throw new Error(result.error ?? "Export could not be created.");
      }
      downloadFile(result);
      setMessage(`Export ready: ${result.fileName}`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export could not be created.");
      setMessage("");
    } finally {
      setExporting(false);
    }
  }

  const scripts = useMemo(() => snapshot?.scripts ?? [], [snapshot?.scripts]);
  const packs = useMemo(() => snapshot?.packs ?? [], [snapshot?.packs]);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? null;
  const selectedScripts = useMemo(() => scripts.filter((script) => selectedScriptIds.includes(script.id)), [scripts, selectedScriptIds]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">Phase 4</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">Export Center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">Export validation packs, SQL files, script inventories, ZIP packages, and audit-ready markdown reports.</p>
      </section>

      {error ? <Alert message={error} /> : null}
      {message ? <section className="rounded-2xl border border-brand-success/30 bg-brand-success/10 p-4 text-sm font-semibold text-brand-success">{message}</section> : null}
      <SummaryCards items={[
        { label: "Available scripts", value: scripts.length, accent: "blue" as const },
        { label: "Validation packs", value: packs.length, accent: "green" as const },
        { label: "Selected scripts", value: selectedScripts.length, accent: "teal" as const },
        { label: "Ready exports", value: scripts.length > 0 ? 4 : 0, accent: "orange" as const },
      ]} />

      <div className="grid gap-5 2xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <h2 className="text-base font-semibold text-brand-text">Export Type</h2>
          <div className="mt-4 space-y-3">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button key={option.value} type="button" onClick={() => setExportType(option.value)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${exportType === option.value ? "border-brand-primary bg-brand-primary/15 text-white" : "border-brand-border bg-brand-card/70 text-brand-secondary hover:text-white"}`}>
                  <Icon className="h-5 w-5 text-[#7AA7FF]" />
                  <span className="text-sm font-semibold">{option.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={exportScripts} disabled={exporting || loading || scripts.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric disabled:cursor-not-allowed disabled:opacity-60">
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Create Export"}
          </button>
        </section>

        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-brand-text">{exportType === "zip_package" ? "Validation Packs" : "Generated Scripts"}</h2>
            {exportType === "zip_package" && selectedPack ? <StatusBadge label={`${selectedPack.script_count} scripts`} tone="ready" /> : null}
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-brand-secondary">Loading export inventory...</p>
          ) : exportType === "zip_package" ? (
            <PackList packs={packs} selectedPackId={selectedPackId} onSelect={setSelectedPackId} />
          ) : (
            <ScriptList scripts={scripts} selectedScriptIds={selectedScriptIds} onToggle={(id) => setSelectedScriptIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
          )}
        </section>
      </div>
    </div>
  );
}

function PackList({ packs, selectedPackId, onSelect }: { packs: ValidationPack[]; selectedPackId: string; onSelect: (id: string) => void }) {
  if (packs.length === 0) return <Empty message="No validation packs yet. Generate validation SQL first." />;
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {packs.map((pack) => (
        <button key={pack.id} type="button" onClick={() => onSelect(pack.id)} className={`rounded-xl border p-4 text-left transition ${selectedPackId === pack.id ? "border-brand-primary bg-brand-primary/15" : "border-brand-border bg-brand-card/70 hover:border-brand-primary/50"}`}>
          <h3 className="text-sm font-semibold text-brand-text">{pack.pack_name}</h3>
          <p className="mt-1 text-xs text-brand-secondary">{pack.description}</p>
          <p className="mt-3 text-xs font-semibold text-brand-teal">{pack.script_count} scripts • {labelize(pack.database_type)}</p>
        </button>
      ))}
    </div>
  );
}

function ScriptList({ scripts, selectedScriptIds, onToggle }: { scripts: ValidationScript[]; selectedScriptIds: string[]; onToggle: (id: string) => void }) {
  if (scripts.length === 0) return <Empty message="No generated scripts yet. Generate validation SQL first." />;
  return (
    <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-brand-border">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
          <tr>
            {["", "Script", "Category", "Database", "Status"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/70">
          {scripts.map((script) => (
            <tr key={script.id} className="text-brand-secondary">
              <td className="px-4 py-3">
                <input type="checkbox" checked={selectedScriptIds.includes(script.id)} onChange={() => onToggle(script.id)} className="h-4 w-4 rounded border-brand-border bg-brand-card accent-brand-primary" aria-label={`Select ${script.script_name}`} />
              </td>
              <td className="px-4 py-3 font-semibold text-brand-text">{script.script_name}</td>
              <td className="px-4 py-3">{labelize(script.validation_category)}</td>
              <td className="px-4 py-3">{labelize(script.database_type)}</td>
              <td className="px-4 py-3"><StatusBadge label={labelize(script.execution_status)} tone="ready" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadFile(result: ExportResponse) {
  const bytes = result.encoding === "base64"
    ? Uint8Array.from(atob(result.fileContent ?? ""), (char) => char.charCodeAt(0))
    : result.fileContent ?? "";
  const blob = new Blob([bytes], { type: result.contentType ?? "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.fileName ?? "etl-qaplanet-export";
  link.click();
  URL.revokeObjectURL(url);
}

function Empty({ message }: { message: string }) {
  return <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">{message}</div>;
}

function Alert({ message }: { message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}
