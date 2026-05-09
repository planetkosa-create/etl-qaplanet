import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import { getExecutionRunDetails, type AuditReport, type EvidenceFile, type ExecutionResult, type ExecutionRun } from "@/lib/etl/execution";

export type AuditReportInput = {
  projectId?: string | null;
  executionRunId: string;
  format?: "markdown";
};

export async function generateAndSaveAuditReport(input: AuditReportInput, userId: string) {
  const supabase = getSupabaseOrThrow();
  const details = await getExecutionRunDetails(input.executionRunId);
  const content = generateAuditReportMarkdown(details.run, details.results, details.evidence);
  const fileName = `${safeFileName(details.run.run_name)}-audit-report.md`;

  const { data, error } = await supabase
    .from("etl_audit_reports")
    .insert({
      project_id: input.projectId ?? details.run.project_id ?? null,
      user_id: userId,
      execution_run_id: details.run.id,
      validation_pack_id: details.run.validation_pack_id,
      report_name: `${details.run.run_name} Audit Report`,
      report_type: input.format ?? "markdown",
      report_content: content,
      file_name: fileName,
      storage_path: null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Audit report could not be generated.");

  return {
    report: data as AuditReport,
    fileName,
    content,
  };
}

export function generateAuditReportMarkdown(run: ExecutionRun, results: ExecutionResult[], evidence: EvidenceFile[]) {
  const summary = buildSummary(results);
  const sourceTables = unique(results.map((result) => result.source_table).filter(Boolean) as string[]);
  const targetTables = unique(results.map((result) => result.target_table).filter(Boolean) as string[]);
  const categories = unique(results.map((result) => result.validation_category).filter(Boolean) as string[]);
  const failed = results.filter((result) => result.status === "failed" || result.status === "needs_review");

  return `# ETL Validation Audit Report

## 1. Executive Summary
This report summarizes the ETL validation execution for ETL QAplanet.

## 2. Execution Summary
- Run Name: ${run.run_name}
- Environment: ${run.environment_name ?? "Not specified"}
- Database: ${run.database_type ?? "Not specified"}
- Total Scripts: ${results.length}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Warnings: ${summary.warning}
- Needs Review: ${summary.needsReview}

## 3. Validation Scope
- Source Tables: ${sourceTables.join(", ") || "Not specified"}
- Target Tables: ${targetTables.join(", ") || "Not specified"}
- Validation Categories: ${categories.join(", ") || "Not specified"}
- Validation Packs: ${run.validation_pack_id ? "Validation pack linked" : "No validation pack linked"}

## 4. Script Inventory
| Script | Category | Source | Target | Status |
|---|---|---|---|---|
${results.map((result) => `| ${escapePipe(result.script_name ?? "")} | ${escapePipe(result.validation_category ?? "")} | ${escapePipe(result.source_table ?? "")} | ${escapePipe(result.target_table ?? "")} | ${result.status} |`).join("\n")}

## 5. Execution Results
| Script | Status | Actual Result | Evidence |
|---|---|---|---|
${results.map((result) => `| ${escapePipe(result.script_name ?? "")} | ${result.status} | ${escapePipe(result.actual_result ?? "")} | ${evidence.filter((item) => item.execution_result_id === result.id).length} file(s) |`).join("\n")}

## 6. Failed Validations
${failed.length === 0 ? "No failed validations were recorded." : failed.map((result) => `- ${result.script_name}: ${result.error_message || result.actual_result || "Needs review."}`).join("\n")}

## 7. Evidence Summary
${evidence.length === 0 ? "No evidence files were uploaded." : evidence.map((file) => `- ${file.file_name} (${file.evidence_type ?? "other"}): ${file.notes ?? "No notes"}`).join("\n")}

## 8. Recommendations
${buildRecommendations(summary)}

## 9. Appendix
Generated SQL inventory and traceability references are available in ETL QAplanet export packages.
`;
}

function buildSummary(results: ExecutionResult[]) {
  return {
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    warning: results.filter((result) => result.status === "warning").length,
    needsReview: results.filter((result) => result.status === "needs_review").length,
  };
}

function buildRecommendations(summary: ReturnType<typeof buildSummary>) {
  const notes = [
    "Review generated SQL before running against any controlled or production environment.",
    "Attach query output evidence for passed and failed validations.",
  ];

  if (summary.failed > 0) notes.push("Investigate failed scripts and document root cause before sign-off.");
  if (summary.needsReview > 0) notes.push("Resolve items marked needs review before audit closure.");
  if (summary.warning > 0) notes.push("Confirm warnings are accepted by the ETL QA lead.");

  return notes.map((note) => `- ${note}`).join("\n");
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function escapePipe(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "etl-validation";
}
