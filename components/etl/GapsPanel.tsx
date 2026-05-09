"use client";

import { AlertTriangle } from "lucide-react";
import { labelize, type AnalysisGap } from "@/lib/etl/analysis";
import { StatusBadge } from "@/components/etl/StatusBadge";

type GapsPanelProps = {
  gaps: AnalysisGap[];
};

export function GapsPanel({ gaps }: GapsPanelProps) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-brand-warning" aria-hidden="true" />
        <h2 className="text-base font-semibold text-brand-text">Analysis Gaps</h2>
      </div>

      {gaps.length === 0 ? (
        <p className="mt-4 text-sm text-brand-secondary">No analysis gaps found yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {gaps.map((gap) => (
            <article key={gap.id} className="rounded-xl border border-brand-border bg-brand-card/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
                    {labelize(gap.gap_type)}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-brand-text">{gap.title || "Untitled gap"}</h3>
                </div>
                <StatusBadge label={labelize(gap.severity)} tone={gap.severity === "critical" || gap.severity === "high" ? "danger" : "warning"} />
              </div>
              <p className="mt-3 text-sm leading-6 text-brand-secondary">{gap.description}</p>
              <p className="mt-3 text-xs leading-5 text-brand-muted">
                <span className="font-semibold text-brand-secondary">Impact:</span> {gap.impact || "Not specified"}
              </p>
              <p className="mt-2 text-xs leading-5 text-brand-muted">
                <span className="font-semibold text-brand-secondary">Recommendation:</span>{" "}
                {gap.recommendation || "Review the mapping source details."}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
