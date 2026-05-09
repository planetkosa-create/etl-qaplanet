import JSZip from "jszip";
import { generateAuditReportMarkdown } from "@/lib/etl/audit-report";
import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import { downloadEvidence } from "@/lib/etl/evidence";
import { getExecutionRunDetails, type EvidenceFile, type ExecutionResult, type ExecutionRun } from "@/lib/etl/execution";
import { getSqlSnapshot, type ValidationPack, type ValidationScript } from "@/lib/etl/sql";

export type ExportPackageType = "sql_zip" | "oracle_sql_zip" | "audit_package" | "evidence_package" | "full_validation_package";

export type ExportPackageRequest = {
  projectId?: string | null;
  validationPackId?: string | null;
  executionRunId?: string | null;
  packageType?: ExportPackageType;
};

export async function createValidationPackageZip(input: ExportPackageRequest, userId: string) {
  const supabase = getSupabaseOrThrow();
  const packageType = input.packageType ?? "full_validation_package";
  const scripts = await resolvePackageScripts(input);
  const pack = input.validationPackId ? await fetchPack(input.validationPackId) : null;
  const runDetails = input.executionRunId ? await getExecutionRunDetails(input.executionRunId) : null;
  const run = runDetails?.run ?? null;
  const results = runDetails?.results ?? [];
  const evidence = runDetails?.evidence ?? [];
  const reportContent = run ? generateAuditReportMarkdown(run, results, evidence) : buildScriptOnlyReport(scripts, pack);
  const manifest = buildPackageManifest({
    packageType,
    scripts,
    pack,
    run,
    results,
    evidence,
  });

  const zip = new JSZip();
  zip.file("README.md", buildReadme(manifest.databaseType));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("reports/etl_validation_audit_report.md", reportContent);
  zip.file("reports/script_inventory.csv", buildScriptInventoryCsv(scripts));
  zip.file("reports/execution_results.csv", buildExecutionResultsCsv(results));

  scripts.forEach((script) => {
    zip.file(`validation-scripts/${categoryFolder(script.validation_category)}/${safeFileName(script.script_name)}.sql`, script.sql_text);
  });

  if (packageType !== "sql_zip" && packageType !== "oracle_sql_zip") {
    await addEvidenceFiles(zip, evidence);
  }

  const fileName = `${safeFileName(pack?.pack_name ?? run?.run_name ?? "etl-validation-package")}-${new Date().toISOString().slice(0, 10)}.zip`;
  const fileContent = await zip.generateAsync({ type: "base64" });

  const { data, error } = await supabase
    .from("etl_export_packages")
    .insert({
      project_id: input.projectId ?? run?.project_id ?? pack?.project_id ?? null,
      user_id: userId,
      validation_pack_id: input.validationPackId ?? run?.validation_pack_id ?? null,
      package_name: manifest.projectName,
      package_type: packageType,
      file_name: fileName,
      storage_path: null,
      manifest_json: manifest,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Validation package could not be created.");

  return {
    package: data,
    fileName,
    fileContent,
    contentType: "application/zip",
    encoding: "base64" as const,
    manifest,
  };
}

export function buildPackageManifest(input: {
  packageType: ExportPackageType;
  scripts: ValidationScript[];
  pack: ValidationPack | null;
  run: ExecutionRun | null;
  results: ExecutionResult[];
  evidence: EvidenceFile[];
}) {
  return {
    projectName: "ETL QAplanet Validation Package",
    generatedDate: new Date().toISOString(),
    databaseType: input.pack?.database_type ?? input.run?.database_type ?? input.scripts[0]?.database_type ?? "oracle",
    validationPackName: input.pack?.pack_name ?? "Selected validation scripts",
    packageType: input.packageType,
    scriptCount: input.scripts.length,
    reportCount: input.run ? 1 : 0,
    evidenceCount: input.evidence.length,
    executionRun: input.run?.run_name ?? null,
    resultCount: input.results.length,
    includedFiles: [
      "README.md",
      "manifest.json",
      "reports/etl_validation_audit_report.md",
      "reports/script_inventory.csv",
      "reports/execution_results.csv",
      "validation-scripts/",
      input.evidence.length > 0 ? "evidence/uploaded-evidence-files/" : null,
    ].filter(Boolean),
  };
}

async function resolvePackageScripts(input: ExportPackageRequest) {
  const supabase = getSupabaseOrThrow();

  if (input.validationPackId) {
    const { data: links, error: linkError } = await supabase
      .from("etl_validation_pack_scripts")
      .select("script_id")
      .eq("pack_id", input.validationPackId);
    if (linkError) throw new Error(linkError.message);
    const ids = (links ?? []).map((link) => link.script_id).filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("etl_validation_scripts").select("*").in("id", ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as ValidationScript[];
  }

  if (input.executionRunId) {
    const details = await getExecutionRunDetails(input.executionRunId);
    const ids = details.results.map((result) => result.script_id).filter(Boolean) as string[];
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("etl_validation_scripts").select("*").in("id", ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as ValidationScript[];
  }

  return (await getSqlSnapshot({ projectId: input.projectId })).scripts;
}

async function fetchPack(id: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.from("etl_validation_packs").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as ValidationPack;
}

async function addEvidenceFiles(zip: JSZip, evidence: EvidenceFile[]) {
  if (evidence.length === 0) {
    zip.file("evidence/README.md", "No evidence files were included in this package.");
    return;
  }

  zip.file("evidence/evidence-inventory.csv", buildEvidenceCsv(evidence));

  await Promise.all(evidence.map(async (file) => {
    if (!file.storage_path) return;
    const bytes = await downloadEvidence(file.storage_path);
    const path = `evidence/uploaded-evidence-files/${safeFileName(file.file_name)}`;
    zip.file(path, bytes ?? `Evidence file ${file.file_name} could not be downloaded from storage.`);
  }));
}

function buildReadme(databaseType: string) {
  return `# ETL QAplanet Validation Package

This package was generated by ETL QAplanet.

Database type: ${databaseType}

## How to review

1. Review generated SQL before running against any controlled or production environment.
2. Confirm schema names, table names, column names, and bind variables.
3. Run scripts manually in an approved validation environment.
4. Attach query output, screenshots, logs, or spreadsheets as evidence.

Safety note: This package contains SELECT-only validation SQL. Do not run against production without approval.
`;
}

function buildScriptOnlyReport(scripts: ValidationScript[], pack: ValidationPack | null) {
  return `# ETL Validation Audit Report

## 1. Executive Summary
This package contains generated validation scripts${pack ? ` from ${pack.pack_name}` : ""}.

## 2. Script Inventory
| Script | Category | Source | Target | Status |
|---|---|---|---|---|
${scripts.map((script) => `| ${escapeCell(script.script_name)} | ${script.validation_category} | ${escapeCell(script.source_table ?? "")} | ${escapeCell(script.target_table ?? "")} | ${script.execution_status} |`).join("\n")}

## 3. Recommendations
- Review generated SQL before running against any controlled or production environment.
- Create an execution run in ETL QAplanet to capture evidence and final audit results.
`;
}

function buildScriptInventoryCsv(scripts: ValidationScript[]) {
  const rows = [
    ["Script", "Category", "Database", "Source", "Target", "Confidence", "Status"],
    ...scripts.map((script) => [
      script.script_name,
      script.validation_category,
      script.database_type,
      script.source_table ?? "",
      script.target_table ?? "",
      String(script.confidence_score ?? ""),
      script.execution_status,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildExecutionResultsCsv(results: ExecutionResult[]) {
  const rows = [
    ["Script", "Status", "Actual Result", "Row Count", "Difference Count", "Difference Amount", "Error", "Evidence Notes"],
    ...results.map((result) => [
      result.script_name ?? "",
      result.status,
      result.actual_result ?? "",
      String(result.row_count ?? ""),
      String(result.difference_count ?? ""),
      String(result.difference_amount ?? ""),
      result.error_message ?? "",
      result.evidence_notes ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildEvidenceCsv(evidence: EvidenceFile[]) {
  const rows = [
    ["File", "Type", "Evidence Type", "Notes", "Uploaded"],
    ...evidence.map((file) => [
      file.file_name,
      file.file_type ?? "",
      file.evidence_type ?? "",
      file.notes ?? "",
      file.uploaded_at,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function categoryFolder(category: string) {
  if (category === "row_count") return "row-count";
  if (category === "duplicate_check") return "duplicate-checks";
  if (category === "null_check") return "null-checks";
  if (category.includes("transformation")) return "transformations";
  if (category.includes("reconciliation") || category.includes("amount")) return "reconciliation";
  return "other-checks";
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "etl-export";
}

function escapeCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
