import Link from "next/link";
import { Code2, UploadCloud } from "lucide-react";
import { AnalysisOverviewGrid } from "@/components/etl/AnalysisOverviewGrid";
import { CodeEditorPanel } from "@/components/etl/CodeEditorPanel";
import { DashboardMetricGrid } from "@/components/etl/DashboardMetricGrid";
import { ExecutionDashboardPanel } from "@/components/etl/ExecutionDashboardPanel";
import { ExecutionReadiness } from "@/components/etl/ExecutionReadiness";
import { RightRail } from "@/components/etl/RightRail";
import { UploadedArtifactsTable } from "@/components/etl/UploadedArtifactsTable";
import { ValidationPacksGrid } from "@/components/etl/ValidationPacksGrid";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">ETL Validation Workspace</h1>
          <p className="mt-2 text-sm text-brand-secondary">
            Upload ETL requirements and generate SQL and Oracle validation scripts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/requirements-upload"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload Requirements
          </Link>
          <Link
            href="/sql-validator-generator"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-5 py-3 text-sm font-semibold text-[#9DBDFF] transition hover:border-brand-primary hover:bg-brand-primary/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          >
            <Code2 className="h-4 w-4" aria-hidden="true" />
            Generate Validation SQL
          </Link>
        </div>
      </section>

      <DashboardMetricGrid />

      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <UploadedArtifactsTable />
            <AnalysisOverviewGrid />
          </div>
          <CodeEditorPanel />
          <ValidationPacksGrid />
          <ExecutionReadiness />
          <ExecutionDashboardPanel />
        </div>
        <RightRail />
      </div>
    </div>
  );
}
