"use client";

import Link from "next/link";
import { useState } from "react";
import { Brain, RotateCcw, Trash2 } from "lucide-react";

type RunResponse = {
  success: boolean;
  analysisRunId?: string;
  counts?: {
    mappings: number;
    rules: number;
    dataQualityChecks: number;
    gaps: number;
  };
  error?: string;
};

type AnalysisRunControlsProps = {
  compact?: boolean;
  onComplete?: () => void;
};

export function AnalysisRunControls({ compact, onComplete }: AnalysisRunControlsProps) {
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  async function runAnalysis() {
    setRunning(true);
    setError("");
    setMessage("Analyzing ETL artifacts...");

    try {
      const response = await fetch("/api/etl/analysis/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as RunResponse;

      if (!response.ok || !result.success || !result.counts) {
        throw new Error(result.error ?? "AI analysis failed.");
      }

      setMessage(
        `AI analysis complete: ${result.counts.mappings} mappings, ${result.counts.rules} rules, ${result.counts.dataQualityChecks} data quality checks, ${result.counts.gaps} gaps extracted.`,
      );
      onComplete?.();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "AI analysis failed.");
      setMessage("");
    } finally {
      setRunning(false);
    }
  }

  async function resetAnalysis() {
    if (confirmText !== "RESET") return;
    setResetting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/etl/analysis/reset", {
        method: "POST",
      });
      const result = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Reset failed.");
      }

      setConfirmText("");
      setMessage("Analysis reset complete. Uploaded artifacts were kept.");
      onComplete?.();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className={`rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow ${compact ? "" : "space-y-4"}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-text">AI Mapping & Rule Analysis</h2>
          <p className="mt-1 text-xs leading-5 text-brand-secondary">
            Analyze processed artifacts to extract mappings, rules, data quality checks, and gaps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running || resetting}
            onClick={runAnalysis}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {running ? "Extracting mappings..." : "Run AI Analysis"}
          </button>
          <Link
            href="/mapping-analysis"
            className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          >
            View results
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="Type RESET to clear analysis"
            className="min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-card px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          />
          <button
            type="button"
            disabled={confirmText !== "RESET" || running || resetting}
            onClick={resetAnalysis}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-danger/40 px-4 py-2.5 text-sm font-semibold text-brand-danger transition hover:bg-brand-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {resetting ? "Resetting..." : "Reset Analysis"}
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm font-semibold text-brand-success">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-brand-danger">{error}</p> : null}
    </section>
  );
}
