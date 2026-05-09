"use client";

import type { ReactNode } from "react";
import { FileText, PackageOpen, PlayCircle } from "lucide-react";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { labelize } from "@/lib/etl/analysis";
import type { ExecutionRun } from "@/lib/etl/execution";

export function ExecutionRunTable({
  runs,
  selectedRunId,
  onSelect,
  onReport,
  onExport,
}: {
  runs: ExecutionRun[];
  selectedRunId: string;
  onSelect: (run: ExecutionRun) => void;
  onReport: (run: ExecutionRun) => void;
  onExport: (run: ExecutionRun) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-card/70 p-8 text-center text-sm text-brand-secondary">
        No execution runs yet. Create a run from generated validation scripts.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
          <tr>
            {["Run Name", "Environment", "Database", "Status", "Total Scripts", "Passed", "Failed", "Needs Review", "Created", "Actions"].map((heading) => (
              <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/70">
          {runs.map((run) => {
            const isSelected = selectedRunId === run.id;
            return (
              <tr key={run.id} className={`text-brand-secondary transition ${isSelected ? "bg-brand-primary/10" : "hover:bg-white/[0.03]"}`}>
                <td className="px-4 py-3 font-semibold text-brand-text">{run.run_name}</td>
                <td className="px-4 py-3">{run.environment_name ?? "QA"}</td>
                <td className="px-4 py-3">{labelize(run.database_type)}</td>
                <td className="px-4 py-3"><StatusBadge label={labelize(run.status)} tone={statusTone(run.status)} /></td>
                <td className="px-4 py-3">{run.total_scripts}</td>
                <td className="px-4 py-3 text-brand-success">{run.passed_count}</td>
                <td className="px-4 py-3 text-brand-danger">{run.failed_count}</td>
                <td className="px-4 py-3 text-brand-warning">{Math.max(0, run.total_scripts - run.passed_count - run.failed_count - run.warning_count - run.skipped_count)}</td>
                <td className="px-4 py-3">{new Date(run.created_at).toLocaleDateString("en")}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton label="View" icon={<PlayCircle className="h-3.5 w-3.5" />} onClick={() => onSelect(run)} />
                    <ActionButton label="Report" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => onReport(run)} />
                    <ActionButton label="Export" icon={<PackageOpen className="h-3.5 w-3.5" />} onClick={() => onExport(run)} />
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

function ActionButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-semibold text-[#7AA7FF] transition hover:bg-brand-primary/10">
      {icon}
      {label}
    </button>
  );
}

function statusTone(status: string) {
  if (status === "completed") return "success";
  if (status === "completed_with_failures" || status === "failed") return "danger";
  if (status === "in_progress") return "processing";
  if (status === "cancelled") return "neutral";
  return "neutral";
}
