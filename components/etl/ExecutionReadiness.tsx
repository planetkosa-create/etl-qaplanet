"use client";

import { useState, type ReactNode } from "react";
import { ClipboardCheck, Route, Zap } from "lucide-react";

export function ExecutionReadiness() {
  const [message, setMessage] = useState("");

  function handleGenerate() {
    setMessage("Export workflow placeholder ready for Phase 2.");
    window.setTimeout(() => setMessage(""), 2600);
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <div className="grid gap-4 xl:grid-cols-[180px_1fr_1fr_1fr_1.4fr]">
        <div>
          <h2 className="text-base font-semibold text-brand-text">Execution Readiness</h2>
          <div className="mt-3 flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "conic-gradient(#22C55E 0 82%, #1E334A 82% 100%)" }}
              aria-label="Execution readiness is 82 percent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-card text-sm font-bold text-white">
                82%
              </div>
            </div>
          </div>
        </div>

        <ReadinessMetric
          title="Automatable"
          value="34"
          percent="82%"
          detail="Ready for execution"
          tone="green"
          icon={<Zap className="h-5 w-5" aria-hidden="true" />}
        />
        <ReadinessMetric
          title="Needs Mapping Review"
          value="6"
          percent="14%"
          detail="Review mappings"
          tone="orange"
          icon={<Route className="h-5 w-5" aria-hidden="true" />}
        />
        <ReadinessMetric
          title="Manual Review"
          value="2"
          percent="4%"
          detail="Requires manual review"
          tone="red"
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
        />

        <article className="rounded-xl border border-brand-border bg-brand-card/70 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#5EA1FF]">Next Step</p>
              <p className="mt-1 text-xs leading-5 text-brand-secondary">
                Select validation packs and generate scripts to start execution.
              </p>
              {message ? <p className="mt-2 text-xs font-semibold text-brand-success">{message}</p> : null}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
            >
              Generate & Export
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

type ReadinessMetricProps = {
  title: string;
  value: string;
  percent: string;
  detail: string;
  tone: "green" | "orange" | "red";
  icon: ReactNode;
};

const toneClasses = {
  green: "text-brand-success",
  orange: "text-brand-warning",
  red: "text-brand-danger",
};

function ReadinessMetric({ title, value, percent, detail, tone, icon }: ReadinessMetricProps) {
  return (
    <article className="rounded-xl border border-brand-border bg-brand-card/70 p-4">
      <div className={`flex items-center gap-2 text-sm font-semibold ${toneClasses[tone]}`}>
        {icon}
        {title}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold text-brand-text">{value}</p>
        <p className="text-xl font-bold text-brand-text">{percent}</p>
      </div>
      <p className="mt-1 text-xs text-brand-secondary">{detail}</p>
    </article>
  );
}
