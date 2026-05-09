"use client";

import { Eye, FileUp } from "lucide-react";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { labelize } from "@/lib/etl/analysis";
import type { EvidenceFile, ExecutionResult, ExecutionResultStatus } from "@/lib/etl/execution";

const quickStatuses: ExecutionResultStatus[] = ["passed", "failed", "warning", "skipped", "needs_review"];

export function ExecutionResultsTable({
  results,
  evidence,
  updatingId,
  onStatus,
  onEvidence,
}: {
  results: ExecutionResult[];
  evidence: EvidenceFile[];
  updatingId: string;
  onStatus: (result: ExecutionResult, status: ExecutionResultStatus) => void;
  onEvidence: (result: ExecutionResult) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">
        No script results are attached to this run yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
          <tr>
            {["Script Name", "Category", "Source Table", "Target Table", "Status", "Actual Result", "Evidence", "Actions"].map((heading) => (
              <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/70">
          {results.map((result) => {
            const evidenceCount = evidence.filter((item) => item.execution_result_id === result.id).length;
            return (
              <tr key={result.id} className="text-brand-secondary transition hover:bg-white/[0.03]">
                <td className="max-w-xs px-4 py-3 font-semibold text-brand-text">{result.script_name ?? "Imported result"}</td>
                <td className="px-4 py-3">{labelize(result.validation_category)}</td>
                <td className="px-4 py-3">{result.source_table ?? "-"}</td>
                <td className="px-4 py-3">{result.target_table ?? "-"}</td>
                <td className="px-4 py-3"><StatusBadge label={labelize(result.status)} tone={resultTone(result.status)} /></td>
                <td className="max-w-xs truncate px-4 py-3">{result.actual_result ?? "-"}</td>
                <td className="px-4 py-3">{evidenceCount > 0 ? <span className="text-brand-success">{evidenceCount} file(s)</span> : <span className="text-brand-muted">None</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {quickStatuses.map((status) => (
                      <button key={status} type="button" onClick={() => onStatus(result, status)} disabled={updatingId === result.id} className="rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-[#7AA7FF] transition hover:bg-brand-primary/10 disabled:opacity-50">
                        {updatingId === result.id ? "Saving" : labelize(status)}
                      </button>
                    ))}
                    <button type="button" onClick={() => onEvidence(result)} className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-brand-teal transition hover:bg-brand-primary/10">
                      <FileUp className="h-3.5 w-3.5" />
                      Evidence
                    </button>
                    <a href="/sql-validator-generator" className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-brand-secondary transition hover:bg-brand-primary/10 hover:text-white">
                      <Eye className="h-3.5 w-3.5" />
                      SQL
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function resultTone(status: string) {
  if (status === "passed") return "success";
  if (status === "failed") return "danger";
  if (status === "warning" || status === "needs_review") return "warning";
  return "neutral";
}
