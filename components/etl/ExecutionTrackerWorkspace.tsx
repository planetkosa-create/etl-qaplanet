"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { FileArchive, FileCheck2, FileInput, FileText, Plus, RefreshCcw } from "lucide-react";
import { AuditReportPreview } from "@/components/etl/AuditReportPreview";
import { EvidenceUploadModal } from "@/components/etl/EvidenceUploadModal";
import { ExecutionResultsTable } from "@/components/etl/ExecutionResultsTable";
import { ExecutionRunTable } from "@/components/etl/ExecutionRunTable";
import { ImportResultsModal } from "@/components/etl/ImportResultsModal";
import { NewExecutionRunModal } from "@/components/etl/NewExecutionRunModal";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize } from "@/lib/etl/analysis";
import type { EvidenceFile, ExecutionResult, ExecutionResultStatus, ExecutionRun, ExecutionSnapshot } from "@/lib/etl/execution";
import type { SqlSnapshot, ValidationPack, ValidationScript } from "@/lib/etl/sql";

type ApiResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

type PackageResponse = ApiResponse & {
  fileName?: string;
  fileContent?: string;
  contentType?: string;
  encoding?: "base64" | "text";
};

type ReportResponse = ApiResponse & {
  fileName?: string;
  content?: string;
};

type CreateRunPayload = {
  runName: string;
  environmentName: string;
  databaseType: string;
  validationPackId?: string;
  scriptIds?: string[];
  executionMethod: "manual";
};

export function ExecutionTrackerWorkspace() {
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null);
  const [scripts, setScripts] = useState<ValidationScript[]>([]);
  const [packs, setPacks] = useState<ValidationPack[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState<ExecutionResult | null>(null);
  const [reportContent, setReportContent] = useState("");
  const [reportFileName, setReportFileName] = useState("etl-validation-audit-report.md");

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [executionResponse, sqlResponse] = await Promise.all([
        fetch("/api/etl/execution/runs", { cache: "no-store" }),
        fetch("/api/etl/sql/scripts", { cache: "no-store" }),
      ]);
      const execution = (await executionResponse.json()) as ExecutionSnapshot & ApiResponse;
      if (!executionResponse.ok || !execution.success) throw new Error(execution.error ?? "Execution tracking data could not be loaded.");
      setSnapshot(execution);
      setSelectedRunId((current) => current || execution.latestRun?.id || execution.runs[0]?.id || "");

      if (sqlResponse.ok) {
        const sql = (await sqlResponse.json()) as SqlSnapshot & ApiResponse;
        if (sql.success) {
          setScripts(sql.scripts ?? []);
          setPacks(sql.packs ?? []);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Execution tracking data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const runs = snapshot?.runs ?? [];
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const results = useMemo(() => (snapshot?.results ?? []).filter((result) => result.execution_run_id === selectedRun?.id), [snapshot?.results, selectedRun?.id]);
  const evidence = useMemo(() => (snapshot?.evidence ?? []).filter((item) => item.execution_run_id === selectedRun?.id), [snapshot?.evidence, selectedRun?.id]);
  const counts = snapshot?.counts;

  const summaryItems = [
    { label: "Total Runs", value: counts?.runs ?? 0, accent: "blue" as const },
    { label: "Latest Run Status", value: selectedRun ? labelize(selectedRun.status) : "None", accent: "teal" as const },
    { label: "Scripts Passed", value: counts?.passed ?? 0, accent: "green" as const },
    { label: "Scripts Failed", value: counts?.failed ?? 0, accent: "red" as const },
    { label: "Needs Review", value: counts?.needsReview ?? 0, accent: "orange" as const },
    { label: "Evidence Files", value: counts?.evidenceFiles ?? 0, accent: "blue" as const },
  ];

  async function createRun(payload: CreateRunPayload) {
    setBusy("create");
    setError("");
    try {
      const response = await fetch("/api/etl/execution/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse & { run?: ExecutionRun; results?: ExecutionResult[] };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Execution run could not be created.");
      setMessage(result.message ?? `Execution run created with ${result.results?.length ?? 0} validation scripts.`);
      setSelectedRunId(result.run?.id ?? "");
      setNewRunOpen(false);
      await loadWorkspace();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Execution run could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function importResults(payload: { runName: string; databaseType: string; environmentName: string; input: string }) {
    setBusy("import");
    setError("");
    try {
      const response = await fetch("/api/etl/execution/results/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResponse & { run?: ExecutionRun };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Execution results could not be imported.");
      setMessage(result.message ?? "Execution results imported successfully.");
      setSelectedRunId(result.run?.id ?? "");
      setImportOpen(false);
      await loadWorkspace();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Execution results could not be imported.");
    } finally {
      setBusy("");
    }
  }

  async function updateResultStatus(result: ExecutionResult, status: ExecutionResultStatus) {
    setBusy(result.id);
    setError("");
    try {
      const response = await fetch(`/api/etl/execution/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actualResult: status === "passed" ? result.actual_result ?? "Validation passed." : result.actual_result }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Result could not be updated.");
      setMessage(payload.message ?? "Result updated successfully.");
      await loadWorkspace();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Result could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function uploadEvidence(payload: { file: File; evidenceType: string; notes: string; result: ExecutionResult }) {
    setBusy("evidence");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", payload.file);
      formData.append("executionRunId", payload.result.execution_run_id ?? "");
      formData.append("executionResultId", payload.result.id);
      if (payload.result.script_id) formData.append("scriptId", payload.result.script_id);
      formData.append("evidenceType", payload.evidenceType);
      formData.append("notes", payload.notes);

      const response = await fetch("/api/etl/evidence/upload", { method: "POST", body: formData });
      const result = (await response.json()) as ApiResponse & { evidence?: EvidenceFile };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Evidence could not be uploaded.");
      setMessage(result.message ?? "Evidence uploaded successfully.");
      setEvidenceTarget(null);
      await loadWorkspace();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Evidence could not be uploaded.");
    } finally {
      setBusy("");
    }
  }

  async function generateReport(run: ExecutionRun | null = selectedRun) {
    if (!run) return;
    setBusy("report");
    setError("");
    try {
      const response = await fetch("/api/etl/reports/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionRunId: run.id, format: "markdown" }),
      });
      const result = (await response.json()) as ReportResponse;
      if (!response.ok || !result.success || !result.content) throw new Error(result.error ?? "Audit report could not be generated.");
      setReportContent(result.content);
      setReportFileName(result.fileName ?? "etl-validation-audit-report.md");
      setMessage(result.message ?? "Audit report generated successfully.");
      await loadWorkspace();
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Audit report could not be generated.");
    } finally {
      setBusy("");
    }
  }

  async function exportPackage(run: ExecutionRun | null = selectedRun, packageType = "full_validation_package") {
    if (!run) return;
    setBusy("package");
    setError("");
    try {
      const response = await fetch("/api/etl/exports/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionRunId: run.id, validationPackId: run.validation_pack_id, packageType }),
      });
      const result = (await response.json()) as PackageResponse;
      if (!response.ok || !result.success || !result.fileContent || !result.fileName) {
        throw new Error(result.error ?? "Validation package could not be exported.");
      }
      downloadFile(result);
      setMessage(result.message ?? "Validation package exported successfully.");
      await loadWorkspace();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Validation package could not be exported.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">Phase 5</span>
        <div className="mt-4 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-text">Execution Tracker</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">Track validation script execution, capture evidence, and prepare audit-ready reports.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton label="New Execution Run" icon={<Plus className="h-4 w-4" />} onClick={() => setNewRunOpen(true)} primary />
            <ActionButton label="Import Results" icon={<FileInput className="h-4 w-4" />} onClick={() => setImportOpen(true)} />
            <ActionButton label={busy === "report" ? "Generating..." : "Generate Audit Report"} icon={<FileText className="h-4 w-4" />} onClick={() => void generateReport()} disabled={!selectedRun || busy === "report"} />
            <ActionButton label={busy === "package" ? "Exporting..." : "Export Evidence Package"} icon={<FileArchive className="h-4 w-4" />} onClick={() => void exportPackage(selectedRun, "full_validation_package")} disabled={!selectedRun || busy === "package"} />
          </div>
        </div>
      </section>

      {error ? <Alert message={error} /> : null}
      {message ? <section className="rounded-2xl border border-brand-success/30 bg-brand-success/10 p-4 text-sm font-semibold text-brand-success">{message}</section> : null}
      <SummaryCards items={summaryItems} />

      {selectedRun ? (
        <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-brand-text">Latest Execution</h2>
              <p className="mt-1 text-sm text-brand-secondary">{selectedRun.run_name} • {selectedRun.environment_name ?? "QA"} • {selectedRun.total_scripts} scripts</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label={labelize(selectedRun.status)} tone={selectedRun.status === "completed" ? "success" : selectedRun.status === "completed_with_failures" ? "warning" : "neutral"} />
              <span className="text-sm font-semibold text-brand-teal">{selectedRun.total_scripts > 0 ? Math.round((selectedRun.passed_count / selectedRun.total_scripts) * 100) : 0}% pass rate</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-brand-text">Execution Runs</h2>
          <button type="button" onClick={() => void loadWorkspace()} className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-3 py-2 text-sm font-semibold text-brand-secondary hover:text-white">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {loading ? <p className="text-sm text-brand-secondary">Loading execution runs...</p> : (
          <ExecutionRunTable runs={runs} selectedRunId={selectedRun?.id ?? ""} onSelect={(run) => setSelectedRunId(run.id)} onReport={(run) => void generateReport(run)} onExport={(run) => void exportPackage(run)} />
        )}
      </section>

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-text">Selected Run Results</h2>
            <p className="mt-1 text-sm text-brand-secondary">{selectedRun ? selectedRun.run_name : "Choose an execution run to review script results."}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-brand-secondary">
            <FileCheck2 className="h-4 w-4 text-brand-success" />
            {evidence.length} evidence file(s)
          </div>
        </div>
        <ExecutionResultsTable results={results} evidence={evidence} updatingId={busy} onStatus={(result, status) => void updateResultStatus(result, status)} onEvidence={setEvidenceTarget} />
      </section>

      <NewExecutionRunModal open={newRunOpen} scripts={scripts} packs={packs} onClose={() => setNewRunOpen(false)} onCreate={createRun} />
      <ImportResultsModal open={importOpen} onClose={() => setImportOpen(false)} onImport={importResults} />
      <EvidenceUploadModal open={Boolean(evidenceTarget)} result={evidenceTarget} onClose={() => setEvidenceTarget(null)} onUpload={uploadEvidence} />
      <AuditReportPreview open={Boolean(reportContent)} content={reportContent} fileName={reportFileName} onClose={() => setReportContent("")} />
    </div>
  );
}

function ActionButton({ label, icon, onClick, primary, disabled }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-brand-primary text-white shadow-blue-glow hover:bg-brand-electric" : "border border-brand-border bg-brand-card/70 text-[#9DBDFF] hover:border-brand-primary hover:bg-brand-primary/10 hover:text-white"}`}>
      {icon}
      {label}
    </button>
  );
}

function Alert({ message }: { message: string }) {
  return <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">{message}</section>;
}

function downloadFile(result: PackageResponse) {
  const bytes = result.encoding === "base64"
    ? Uint8Array.from(atob(result.fileContent ?? ""), (char) => char.charCodeAt(0))
    : result.fileContent ?? "";
  const blob = new Blob([bytes], { type: result.contentType ?? "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.fileName ?? "etl-qaplanet-validation-package.zip";
  link.click();
  URL.revokeObjectURL(url);
}
