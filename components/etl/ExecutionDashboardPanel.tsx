"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardCheck, FileArchive } from "lucide-react";
import { StatusBadge } from "@/components/etl/StatusBadge";
import { SummaryCards } from "@/components/etl/SummaryCards";
import { labelize } from "@/lib/etl/analysis";
import type { ExecutionSnapshot } from "@/lib/etl/execution";

export function ExecutionDashboardPanel() {
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null);

  useEffect(() => {
    async function loadExecution() {
      try {
        const response = await fetch("/api/etl/execution/runs", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as ExecutionSnapshot & { success: boolean };
        if (result.success) setSnapshot(result);
      } catch {
        setSnapshot(null);
      }
    }

    void loadExecution();
  }, []);

  const latest = snapshot?.latestRun ?? null;
  const counts = snapshot?.counts;

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-brand-teal" />
          <h2 className="text-base font-semibold text-brand-text">Execution & Audit Readiness</h2>
        </div>
        <Link href="/execution-tracker" className="text-sm font-semibold text-[#63A2FF] hover:text-white">Open tracker</Link>
      </div>
      <div className="mt-4">
        <SummaryCards items={[
          { label: "Execution Runs", value: counts?.runs ?? 0, accent: "blue" as const },
          { label: "Passed Scripts", value: counts?.passed ?? 0, accent: "green" as const },
          { label: "Failed Scripts", value: counts?.failed ?? 0, accent: "red" as const },
          { label: "Evidence Files", value: counts?.evidenceFiles ?? 0, accent: "teal" as const },
          { label: "Audit Reports", value: counts?.auditReports ?? 0, accent: "orange" as const },
        ]} />
      </div>
      <div className="mt-4 rounded-xl border border-brand-border bg-brand-card/70 p-4">
        {latest ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-text">{latest.run_name}</p>
              <p className="mt-1 text-xs text-brand-secondary">{latest.environment_name ?? "QA"} • {latest.total_scripts} scripts • {Math.round((latest.passed_count / Math.max(latest.total_scripts, 1)) * 100)}% pass rate</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label={labelize(latest.status)} tone={latest.status === "completed" ? "success" : latest.status === "completed_with_failures" ? "warning" : "neutral"} />
              <FileArchive className="h-5 w-5 text-[#7AA7FF]" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-brand-secondary">No execution runs yet. Create a run from generated validation scripts.</p>
        )}
      </div>
    </section>
  );
}
