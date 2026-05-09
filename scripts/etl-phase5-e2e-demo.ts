import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import JSZip from "jszip";

loadEnvConfig(process.cwd());

type DemoContext = {
  supabase: SupabaseClient;
  projectId: string | null;
  resetDemo: boolean;
};

type DemoIds = {
  analysisRunId: string;
  validationPackId: string;
  executionRunId: string;
  auditReportId: string;
  exportPackageId: string;
};

type ScriptRow = {
  id: string;
  script_name: string;
  validation_category: string;
  source_table: string | null;
  target_table: string | null;
  source_column: string | null;
  target_column: string | null;
  sql_text: string;
};

type ResultPlan = {
  scriptName: string;
  status: "passed" | "failed" | "warning" | "skipped" | "needs_review";
  actualResult: string;
  rowCount?: number;
  differenceCount?: number;
  differenceAmount?: number;
  errorMessage?: string;
  evidenceNotes: string;
};

const demoProjectName = "ETL QAplanet Phase 5 Demo - Payments DW";
const demoRunName = "Payments DW Oracle Validation Run";
const demoPackName = "Payments DW Oracle Validation Pack";
const demoReportName = "Payments DW Oracle Validation Audit Report";
const demoPackageName = "Payments DW Oracle Full Validation Package";
const demoPackageFileName = "payments_dw_oracle_full_validation_package.zip";
const demoReportFileName = "payments_dw_oracle_validation_audit_report.md";

const demoArtifactNames = [
  "ETL_Phase5_Source_Target_Mapping.csv",
  "ETL_Phase5_Business_Rules.txt",
];

function validateEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error([
      "Missing required environment variables.",
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this demo.",
      "SUPABASE_SERVICE_ROLE_KEY is used only by this server-side local script.",
    ].join(" "));
  }

  return { url, serviceKey };
}

function createSupabaseAdminClient() {
  const env = validateEnv();
  return createClient(env.url, env.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function main() {
  try {
    const supabase = createSupabaseAdminClient();
    const context: DemoContext = {
      supabase,
      projectId: await resolveProjectId(supabase),
      resetDemo: process.argv.includes("--reset-demo"),
    };

    console.log("Starting ETL QAplanet Phase 5 demo runner...");
    console.log(`Project: ${context.projectId ?? `${demoProjectName} (project_id left null)`}`);

    await safeDeleteExistingDemoData(context);
    const artifacts = await ensureDemoArtifacts(context);
    const analysisRunId = await ensureAnalysisResults(context, artifacts.map((artifact) => artifact.id));
    const scripts = await generateOrSeedOracleValidationScripts(context, analysisRunId);
    const validationPackId = await createPackAndLinks(context, analysisRunId, scripts);
    const executionRunId = await createRunAndResults(context, analysisRunId, validationPackId, scripts);
    const evidence = await createEvidenceRecords(context, executionRunId, scripts);
    const auditReport = await generateAuditReport(context, executionRunId, scripts, evidence);
    const exportPackage = await exportFullValidationPackage(context, validationPackId, executionRunId, scripts, evidence, auditReport.content);

    const summary = await collectSummary(context, analysisRunId, validationPackId, executionRunId);
    printSummary({
      ...summary,
      ids: {
        analysisRunId,
        validationPackId,
        executionRunId,
        auditReportId: auditReport.id,
        exportPackageId: exportPackage.id,
      },
      packagePath: exportPackage.localPath,
    });

    process.exitCode = 0;
  } catch (error) {
    console.error("ETL QAplanet Phase 5 demo failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function resolveProjectId(supabase: SupabaseClient) {
  const envProjectId = process.env.ETL_QAPLANET_DEMO_PROJECT_ID?.trim();
  if (envProjectId) return envProjectId;

  const { data, error } = await supabase
    .from("projects")
    .select("id,name")
    .eq("name", demoProjectName)
    .maybeSingle();

  if (!error && data?.id) return data.id as string;

  if (!error) {
    const insert = await supabase.from("projects").insert({ name: demoProjectName }).select("id").single();
    if (!insert.error && insert.data?.id) return insert.data.id as string;
  }

  return null;
}

async function safeDeleteExistingDemoData(context: DemoContext) {
  const { supabase } = context;
  console.log("Cleaning prior Phase 5 demo records...");

  await supabase.from("etl_export_packages").delete().eq("package_name", demoPackageName);
  await supabase.from("etl_audit_reports").delete().eq("report_name", demoReportName);
  await supabase.from("etl_execution_runs").delete().eq("run_name", demoRunName);

  const { data: packs } = await supabase.from("etl_validation_packs").select("id").eq("pack_name", demoPackName);
  const packIds = (packs ?? []).map((pack) => pack.id).filter(Boolean);
  if (packIds.length > 0) {
    await supabase.from("etl_validation_pack_scripts").delete().in("pack_id", packIds);
    await supabase.from("etl_validation_packs").delete().in("id", packIds);
  }

  await supabase.from("etl_validation_scripts").delete().like("generated_from", "phase5_demo:%");

  if (context.resetDemo) {
    console.log("Reset flag detected. Cleaning demo artifacts and demo analysis run too...");
    await supabase.from("etl_artifacts").delete().in("file_name", demoArtifactNames);
    await supabase.from("etl_analysis_runs").delete().eq("run_name", demoProjectName);
  }
}

async function ensureDemoArtifacts(context: DemoContext) {
  const { supabase } = context;
  const { data: processedArtifacts, error } = await supabase
    .from("etl_artifacts")
    .select("*")
    .eq("processing_status", "processed")
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`Could not read ETL artifacts: ${error.message}`);

  const demoArtifacts = (processedArtifacts ?? []).filter((artifact) => demoArtifactNames.includes(artifact.file_name));
  if (demoArtifacts.length >= 2) return demoArtifacts;

  if ((processedArtifacts ?? []).length > 0) {
    console.log(`Existing processed artifacts found: ${(processedArtifacts ?? []).length}. Adding demo payment artifacts for repeatable Phase 5 coverage.`);
  } else {
    console.log("No processed artifacts found. Seeding demo payment artifacts.");
  }

  await upsertDemoArtifact(context, {
    file_name: "ETL_Phase5_Source_Target_Mapping.csv",
    file_type: "CSV",
    source_kind: "source_target_mapping",
    extracted_text: demoMappingText(),
    extracted_json: {
      headers: ["source_table", "source_column", "target_table", "target_column", "mapping_type", "rule"],
      rows: demoMappingRows(),
    },
  });

  await upsertDemoArtifact(context, {
    file_name: "ETL_Phase5_Business_Rules.txt",
    file_type: "TXT",
    source_kind: "transformation_logic",
    extracted_text: demoBusinessRulesText(),
    extracted_json: { rules: demoBusinessRuleList() },
  });

  const result = await supabase
    .from("etl_artifacts")
    .select("*")
    .in("file_name", demoArtifactNames)
    .eq("processing_status", "processed")
    .order("uploaded_at", { ascending: false });

  if (result.error) throw new Error(`Could not load seeded demo artifacts: ${result.error.message}`);
  return result.data ?? [];
}

async function upsertDemoArtifact(context: DemoContext, artifact: {
  file_name: string;
  file_type: string;
  source_kind: string;
  extracted_text: string;
  extracted_json: unknown;
}) {
  const { supabase, projectId } = context;
  const { data: existing } = await supabase
    .from("etl_artifacts")
    .select("id")
    .eq("file_name", artifact.file_name)
    .maybeSingle();

  const row = {
    project_id: projectId,
    user_id: null,
    file_name: artifact.file_name,
    file_type: artifact.file_type,
    file_size: artifact.extracted_text.length,
    storage_path: null,
    extracted_text: artifact.extracted_text,
    extracted_json: artifact.extracted_json,
    source_kind: artifact.source_kind,
    processing_status: "processed",
    processing_error: null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = existing?.id
    ? await supabase.from("etl_artifacts").update(row).eq("id", existing.id)
    : await supabase.from("etl_artifacts").insert(row);

  if (result.error) throw new Error(`Could not upsert demo artifact ${artifact.file_name}: ${result.error.message}`);
}

async function ensureAnalysisResults(context: DemoContext, artifactIds: string[]) {
  const { supabase, projectId } = context;
  const existing = await supabase
    .from("etl_analysis_runs")
    .select("id")
    .eq("run_name", demoProjectName)
    .eq("status", "completed")
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    const [mappings, rules, checks] = await Promise.all([
      supabase.from("etl_mapping_items").select("id").eq("analysis_run_id", existing.data.id).limit(1),
      supabase.from("etl_rule_items").select("id").eq("analysis_run_id", existing.data.id).limit(1),
      supabase.from("etl_data_quality_items").select("id").eq("analysis_run_id", existing.data.id).limit(1),
    ]);

    if ((mappings.data?.length ?? 0) > 0 && (rules.data?.length ?? 0) > 0 && (checks.data?.length ?? 0) > 0) {
      return existing.data.id as string;
    }
  }

  console.log("Seeding deterministic Phase 3 analysis results.");
  const artifactId = artifactIds[0] ?? null;
  const now = new Date().toISOString();
  const { data: run, error } = await supabase
    .from("etl_analysis_runs")
    .insert({
      project_id: projectId,
      user_id: null,
      run_name: demoProjectName,
      status: "completed",
      artifact_count: artifactIds.length,
      model_name: "deterministic-demo-runner",
      input_summary: "Payments DW source-to-target mapping and business rules demo artifacts.",
      output_summary: "Extracted mappings, validation rules, and data quality checks for Payments DW.",
      started_at: now,
      completed_at: now,
    })
    .select("id")
    .single();

  if (error || !run) throw new Error(`Could not seed analysis run: ${error?.message ?? "unknown error"}`);
  const analysisRunId = run.id as string;

  await insertRows(supabase, "etl_mapping_items", demoMappings(analysisRunId, artifactId, projectId));
  await insertRows(supabase, "etl_rule_items", demoRules(analysisRunId, artifactId, projectId));
  await insertRows(supabase, "etl_data_quality_items", demoDataQualityChecks(analysisRunId, artifactId, projectId));

  return analysisRunId;
}

async function generateOrSeedOracleValidationScripts(context: DemoContext, analysisRunId: string) {
  const { supabase, projectId } = context;
  console.log("Generating deterministic Oracle validation scripts.");
  const scripts = oracleScripts().map((script) => {
    assertSafeSelectOnlySql(script.sql_text);
    return {
      project_id: projectId,
      user_id: null,
      analysis_run_id: analysisRunId,
      script_name: script.script_name,
      script_type: script.script_type,
      database_type: "oracle",
      validation_category: script.validation_category,
      source_table: script.source_table,
      target_table: script.target_table,
      source_column: script.source_column,
      target_column: script.target_column,
      sql_text: script.sql_text.trim().concat("\n"),
      description: script.description,
      generated_from: `phase5_demo:${script.key}`,
      confidence_score: 92,
      execution_status: "ready",
    };
  });

  const { data, error } = await supabase.from("etl_validation_scripts").insert(scripts).select("*");
  if (error) throw new Error(`Could not save demo validation scripts: ${error.message}`);
  return (data ?? []) as ScriptRow[];
}

async function createPackAndLinks(context: DemoContext, analysisRunId: string, scripts: ScriptRow[]) {
  const { supabase, projectId } = context;
  const { data: pack, error } = await supabase
    .from("etl_validation_packs")
    .insert({
      project_id: projectId,
      user_id: null,
      analysis_run_id: analysisRunId,
      pack_name: demoPackName,
      pack_type: "full_validation_suite",
      description: "Complete Oracle validation suite for Payments DW demo workflow.",
      script_count: scripts.length,
      database_type: "oracle",
    })
    .select("id")
    .single();

  if (error || !pack) throw new Error(`Could not create validation pack: ${error?.message ?? "unknown error"}`);

  await insertRows(supabase, "etl_validation_pack_scripts", scripts.map((script) => ({
    pack_id: pack.id,
    script_id: script.id,
  })));

  return pack.id as string;
}

async function createRunAndResults(context: DemoContext, analysisRunId: string, validationPackId: string, scripts: ScriptRow[]) {
  const { supabase, projectId } = context;
  const now = new Date().toISOString();
  const { data: run, error } = await supabase
    .from("etl_execution_runs")
    .insert({
      project_id: projectId,
      user_id: null,
      analysis_run_id: analysisRunId,
      validation_pack_id: validationPackId,
      run_name: demoRunName,
      database_type: "oracle",
      environment_name: "QA",
      execution_method: "manual",
      status: "completed_with_failures",
      total_scripts: scripts.length,
      passed_count: 7,
      failed_count: 2,
      warning_count: 1,
      skipped_count: 0,
      started_at: now,
      completed_at: now,
    })
    .select("id")
    .single();

  if (error || !run) throw new Error(`Could not create execution run: ${error?.message ?? "unknown error"}`);
  const executionRunId = run.id as string;
  const plans = resultPlans();

  await insertRows(supabase, "etl_execution_results", scripts.map((script) => {
    const plan = plans.find((item) => item.scriptName === script.script_name) ?? plans[0];
    return {
      execution_run_id: executionRunId,
      script_id: script.id,
      project_id: projectId,
      user_id: null,
      script_name: script.script_name,
      validation_category: script.validation_category,
      source_table: script.source_table,
      target_table: script.target_table,
      status: plan.status,
      expected_result: expectedResult(script.validation_category),
      actual_result: plan.actualResult,
      row_count: plan.rowCount ?? null,
      difference_count: plan.differenceCount ?? null,
      difference_amount: plan.differenceAmount ?? null,
      error_message: plan.errorMessage ?? null,
      evidence_notes: plan.evidenceNotes,
      executed_at: now,
    };
  }));

  return executionRunId;
}

async function createEvidenceRecords(context: DemoContext, executionRunId: string, scripts: ScriptRow[]) {
  const { supabase, projectId } = context;
  const { data: results, error } = await supabase
    .from("etl_execution_results")
    .select("*")
    .eq("execution_run_id", executionRunId);

  if (error) throw new Error(`Could not load execution results for evidence: ${error.message}`);

  const evidenceInputs = evidenceFiles();
  const bucketExists = await evidenceBucketExists(supabase);
  const rows = [];

  for (const evidence of evidenceInputs) {
    const script = scripts.find((item) => item.script_name === evidence.scriptName);
    const result = (results ?? []).find((item) => item.script_id === script?.id);
    const storagePath = bucketExists
      ? await uploadEvidenceContent(supabase, evidence.fileName, evidence.content)
      : null;

    rows.push({
      project_id: projectId,
      user_id: null,
      execution_run_id: executionRunId,
      execution_result_id: result?.id ?? null,
      script_id: script?.id ?? null,
      file_name: evidence.fileName,
      file_type: evidence.fileName.split(".").pop()?.toUpperCase() ?? "TXT",
      file_size: Buffer.byteLength(evidence.content),
      storage_path: storagePath,
      evidence_type: evidence.type,
      notes: evidence.notes,
    });
  }

  await insertRows(supabase, "etl_evidence_files", rows);
  const created = await supabase.from("etl_evidence_files").select("*").eq("execution_run_id", executionRunId);
  if (created.error) throw new Error(`Could not read created evidence: ${created.error.message}`);
  if (!bucketExists) console.log("etl-evidence bucket not available; created evidence metadata with storage_path null.");
  return created.data ?? [];
}

async function generateAuditReport(context: DemoContext, executionRunId: string, scripts: ScriptRow[], evidence: Record<string, unknown>[]) {
  const { supabase, projectId } = context;
  const { data: run } = await supabase.from("etl_execution_runs").select("*").eq("id", executionRunId).single();
  const { data: results } = await supabase.from("etl_execution_results").select("*").eq("execution_run_id", executionRunId);
  const content = generateAuditMarkdown(run, results ?? [], scripts, evidence);

  const { data, error } = await supabase
    .from("etl_audit_reports")
    .insert({
      project_id: projectId,
      user_id: null,
      execution_run_id: executionRunId,
      validation_pack_id: run?.validation_pack_id ?? null,
      report_name: demoReportName,
      report_type: "markdown",
      report_content: content,
      file_name: demoReportFileName,
      storage_path: null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Could not create audit report: ${error?.message ?? "unknown error"}`);
  return { id: data.id as string, content };
}

async function exportFullValidationPackage(
  context: DemoContext,
  validationPackId: string,
  executionRunId: string,
  scripts: ScriptRow[],
  evidence: Record<string, unknown>[],
  auditContent: string,
) {
  const { supabase, projectId } = context;
  const { data: results } = await supabase.from("etl_execution_results").select("*").eq("execution_run_id", executionRunId);
  const manifest = {
    project_name: demoProjectName,
    package_generated_date: new Date().toISOString(),
    database_type: "oracle",
    validation_pack_name: demoPackName,
    script_count: scripts.length,
    passed_count: 7,
    failed_count: 2,
    warning_count: 1,
    evidence_count: evidence.length,
    report_count: 1,
    execution_run_id: executionRunId,
    included_files: [
      "etl-validation-package/README.md",
      "etl-validation-package/manifest.json",
      "etl-validation-package/validation-scripts/",
      "etl-validation-package/reports/",
      "etl-validation-package/evidence/",
    ],
  };

  const zip = new JSZip();
  const root = zip.folder("etl-validation-package");
  if (!root) throw new Error("Could not create ZIP package.");

  root.file("README.md", buildPackageReadme());
  root.file("manifest.json", JSON.stringify(manifest, null, 2));
  const scriptRoot = root.folder("validation-scripts");
  scripts.forEach((script) => {
    scriptRoot?.folder(categoryFolder(script.validation_category))?.file(`${safeFileName(script.script_name)}.sql`, script.sql_text);
  });
  const reports = root.folder("reports");
  reports?.file(demoReportFileName, auditContent);
  reports?.file("script_inventory.csv", createCsv([
    ["Script", "Category", "Source", "Target", "Status"],
    ...scripts.map((script) => [script.script_name, script.validation_category, script.source_table ?? "", script.target_table ?? "", "ready"]),
  ]));
  reports?.file("execution_results.csv", createCsv([
    ["Script", "Status", "Actual Result", "Evidence Notes"],
    ...(results ?? []).map((result) => [result.script_name ?? "", result.status ?? "", result.actual_result ?? "", result.evidence_notes ?? ""]),
  ]));

  const evidenceRoot = root.folder("evidence");
  evidenceRoot?.file("evidence_manifest.csv", createCsv([
    ["File", "Evidence Type", "Notes"],
    ...evidence.map((item) => [String(item.file_name ?? ""), String(item.evidence_type ?? ""), String(item.notes ?? "")]),
  ]));
  for (const file of evidenceFiles()) {
    evidenceRoot?.file(file.fileName, file.content);
  }

  const outputDir = path.join(process.cwd(), ".demo-output");
  await mkdir(outputDir, { recursive: true });
  const localPath = path.join(outputDir, demoPackageFileName);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(localPath, zipBuffer);

  const storagePath = await tryUploadExportPackage(supabase, zipBuffer);
  const { data, error } = await supabase
    .from("etl_export_packages")
    .insert({
      project_id: projectId,
      user_id: null,
      validation_pack_id: validationPackId,
      package_name: demoPackageName,
      package_type: "full_validation_package",
      file_name: demoPackageFileName,
      storage_path: storagePath,
      manifest_json: manifest,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Could not create export package record: ${error?.message ?? "unknown error"}`);
  return { id: data.id as string, localPath };
}

async function collectSummary(context: DemoContext, analysisRunId: string, validationPackId: string, executionRunId: string) {
  const { supabase } = context;
  const [artifacts, mappings, rules, checks, scripts, packs, results, evidence] = await Promise.all([
    supabase.from("etl_artifacts").select("id", { count: "exact", head: true }).eq("processing_status", "processed"),
    supabase.from("etl_mapping_items").select("id", { count: "exact", head: true }).eq("analysis_run_id", analysisRunId),
    supabase.from("etl_rule_items").select("id", { count: "exact", head: true }).eq("analysis_run_id", analysisRunId),
    supabase.from("etl_data_quality_items").select("id", { count: "exact", head: true }).eq("analysis_run_id", analysisRunId),
    supabase.from("etl_validation_scripts").select("id", { count: "exact", head: true }).eq("analysis_run_id", analysisRunId).eq("database_type", "oracle"),
    supabase.from("etl_validation_packs").select("id", { count: "exact", head: true }).eq("id", validationPackId),
    supabase.from("etl_execution_results").select("status").eq("execution_run_id", executionRunId),
    supabase.from("etl_evidence_files").select("id", { count: "exact", head: true }).eq("execution_run_id", executionRunId),
  ]);

  const resultRows = results.data ?? [];
  return {
    artifacts: artifacts.count ?? 0,
    mappings: mappings.count ?? 0,
    rules: rules.count ?? 0,
    checks: checks.count ?? 0,
    scripts: scripts.count ?? 0,
    packs: packs.count ?? 0,
    evidence: evidence.count ?? 0,
    passed: resultRows.filter((item) => item.status === "passed").length,
    failed: resultRows.filter((item) => item.status === "failed").length,
    warning: resultRows.filter((item) => item.status === "warning").length,
  };
}

function printSummary(input: Awaited<ReturnType<typeof collectSummary>> & { ids: DemoIds; packagePath: string }) {
  console.log("");
  console.log("ETL QAplanet Phase 5 Demo Complete");
  console.log("");
  console.log("Artifacts:");
  console.log(`- Processed artifacts: ${input.artifacts}`);
  console.log("");
  console.log("Analysis:");
  console.log(`- Mappings: ${input.mappings}`);
  console.log(`- Rules: ${input.rules}`);
  console.log(`- Data quality checks: ${input.checks}`);
  console.log("");
  console.log("SQL Generation:");
  console.log(`- Oracle validation scripts: ${input.scripts}`);
  console.log(`- Validation packs: ${input.packs}`);
  console.log("");
  console.log("Execution:");
  console.log(`- Run name: ${demoRunName}`);
  console.log("- Status: completed_with_failures");
  console.log("- Total scripts: 10");
  console.log(`- Passed: ${input.passed}`);
  console.log(`- Failed: ${input.failed}`);
  console.log(`- Warning: ${input.warning}`);
  console.log("- Pass rate: 70%");
  console.log("");
  console.log("Evidence:");
  console.log(`- Evidence records: ${input.evidence}`);
  console.log("");
  console.log("Audit:");
  console.log(`- Report: ${demoReportFileName}`);
  console.log("");
  console.log("Export:");
  console.log(`- Package: ${demoPackageFileName}`);
  console.log(`- Local package path: ${input.packagePath}`);
  console.log("");
  console.log("Useful IDs:");
  console.log(`- analysisRunId: ${input.ids.analysisRunId}`);
  console.log(`- validationPackId: ${input.ids.validationPackId}`);
  console.log(`- executionRunId: ${input.ids.executionRunId}`);
  console.log(`- auditReportId: ${input.ids.auditReportId}`);
  console.log(`- exportPackageId: ${input.ids.exportPackageId}`);
}

function assertSafeSelectOnlySql(sql: string) {
  const withoutComments = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const restricted = /\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|MERGE|GRANT|REVOKE|EXECUTE\s+IMMEDIATE)\b/i;
  if (restricted.test(withoutComments)) {
    throw new Error("Unsafe SQL detected.");
  }
}

async function insertRows(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
}

async function evidenceBucketExists(supabase: SupabaseClient) {
  const { data, error } = await supabase.storage.getBucket("etl-evidence");
  return !error && Boolean(data);
}

async function uploadEvidenceContent(supabase: SupabaseClient, fileName: string, content: string) {
  const storagePath = `phase5-demo/${new Date().toISOString().replace(/[:.]/g, "-")}-${fileName}`;
  const { error } = await supabase.storage.from("etl-evidence").upload(storagePath, Buffer.from(content), {
    contentType: fileName.endsWith(".csv") ? "text/csv" : "text/plain",
    upsert: true,
  });
  return error ? null : storagePath;
}

async function tryUploadExportPackage(supabase: SupabaseClient, zipBuffer: Buffer) {
  const bucketExists = await evidenceBucketExists(supabase);
  if (!bucketExists) return null;
  const storagePath = `phase5-demo/${demoPackageFileName}`;
  const { error } = await supabase.storage.from("etl-evidence").upload(storagePath, zipBuffer, {
    contentType: "application/zip",
    upsert: true,
  });
  return error ? null : storagePath;
}

function demoMappingRows() {
  return [
    ["SRC_PAYMENTS_STG", "PAYMENT_ID", "TGT_PAYMENTS_DW", "PAYMENT_ID", "direct", "Preserve payment identifier."],
    ["SRC_PAYMENTS_STG", "CUSTOMER_ID", "TGT_PAYMENTS_DW", "CUSTOMER_ID", "direct", "Preserve customer ID."],
    ["SRC_PAYMENTS_STG", "PAYMENT_AMOUNT", "TGT_PAYMENTS_DW", "PAYMENT_AMOUNT", "transformed", "NVL(PAYMENT_AMOUNT, 0)."],
    ["SRC_PAYMENTS_STG", "PAYMENT_STATUS", "TGT_PAYMENTS_DW", "PAYMENT_STATUS", "transformed", "Map PAID/SETTLED to COMPLETED."],
    ["SRC_PAYMENTS_STG", "PAYMENT_DATE", "TGT_PAYMENTS_DW", "PAYMENT_DATE_KEY", "derived", "YYYYMMDD numeric date key."],
    ["SRC_PAYMENTS_STG", "CUSTOMER_ID", "TGT_PAYMENTS_DW", "CUSTOMER_KEY", "lookup", "Join to DIM_CUSTOMER."],
  ];
}

function demoMappingText() {
  return [
    "source_table,source_column,target_table,target_column,mapping_type,rule",
    ...demoMappingRows().map((row) => row.join(",")),
  ].join("\n");
}

function demoBusinessRuleList() {
  return [
    "RULE-001 row count reconciliation by LOAD_DT",
    "RULE-002 payment amount sum reconciliation",
    "RULE-003 duplicate PAYMENT_ID detection",
    "RULE-004 required PAYMENT_ID null check",
    "RULE-005 payment status transformation validation",
    "RULE-006 customer lookup join validation",
    "RULE-007 load date filter validation",
    "RULE-008 audit created/updated timestamp validation",
  ];
}

function demoBusinessRulesText() {
  return demoBusinessRuleList().join("\n");
}

function demoMappings(analysisRunId: string, artifactId: string | null, projectId: string | null) {
  return [
    mapping(analysisRunId, artifactId, projectId, "PAYMENT_ID", "PAYMENT_ID", "direct", "Direct mapping", true, true),
    mapping(analysisRunId, artifactId, projectId, "CUSTOMER_ID", "CUSTOMER_ID", "direct", "Direct mapping", true, false),
    mapping(analysisRunId, artifactId, projectId, "PAYMENT_AMOUNT", "PAYMENT_AMOUNT", "transformed", "NVL(PAYMENT_AMOUNT, 0)", true, false),
    mapping(analysisRunId, artifactId, projectId, "PAYMENT_STATUS", "PAYMENT_STATUS", "transformed", "CASE WHEN PAYMENT_STATUS IN ('PAID','SETTLED') THEN 'COMPLETED' ELSE PAYMENT_STATUS END", true, false),
    mapping(analysisRunId, artifactId, projectId, "PAYMENT_DATE", "PAYMENT_DATE_KEY", "derived", "TO_NUMBER(TO_CHAR(PAYMENT_DATE, 'YYYYMMDD'))", true, false),
    {
      ...mapping(analysisRunId, artifactId, projectId, "CUSTOMER_ID", "CUSTOMER_KEY", "lookup", "Lookup DIM_CUSTOMER.CUSTOMER_KEY", true, false),
      join_condition: "SRC_PAYMENTS_STG.CUSTOMER_ID = DIM_CUSTOMER.CUSTOMER_ID",
    },
  ];
}

function mapping(analysisRunId: string, artifactId: string | null, projectId: string | null, sourceColumn: string, targetColumn: string, mappingType: string, rule: string, required: boolean, key: boolean) {
  return {
    analysis_run_id: analysisRunId,
    artifact_id: artifactId,
    project_id: projectId,
    user_id: null,
    source_system: "SRC",
    source_table: "SRC_PAYMENTS_STG",
    source_column: sourceColumn,
    target_system: "DW",
    target_table: "TGT_PAYMENTS_DW",
    target_column: targetColumn,
    data_type: sourceColumn.includes("AMOUNT") ? "NUMBER" : "VARCHAR2",
    transformation_rule: rule,
    business_rule: `${sourceColumn} validates ${targetColumn} for Payments DW.`,
    mapping_type: mappingType,
    join_condition: null,
    filter_condition: "TRUNC(LOAD_DT) = :LOAD_DATE",
    is_required: required,
    is_key: key,
    confidence_score: 92,
  };
}

function demoRules(analysisRunId: string, artifactId: string | null, projectId: string | null) {
  const base = { analysis_run_id: analysisRunId, artifact_id: artifactId, project_id: projectId, user_id: null, confidence_score: 92 };
  return [
    { ...base, rule_reference: "RULE-001", rule_type: "reconciliation", title: "Row count reconciliation", description: "Source and target row counts must match by LOAD_DT.", source_expression: "COUNT(*) FROM SRC_PAYMENTS_STG WHERE TRUNC(LOAD_DT) = :LOAD_DATE", target_expression: "COUNT(*) FROM TGT_PAYMENTS_DW WHERE TRUNC(LOAD_DT) = :LOAD_DATE", validation_intent: "Row count reconciliation", affected_tables: ["SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW"], affected_columns: ["LOAD_DT"], severity: "critical" },
    { ...base, rule_reference: "RULE-002", rule_type: "reconciliation", title: "Payment amount sum reconciliation", description: "Source and target payment amount totals must reconcile.", source_expression: "SUM(PAYMENT_AMOUNT) FROM SRC_PAYMENTS_STG", target_expression: "SUM(PAYMENT_AMOUNT) FROM TGT_PAYMENTS_DW", validation_intent: "Sum reconciliation", affected_tables: ["SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW"], affected_columns: ["PAYMENT_AMOUNT"], severity: "high" },
    { ...base, rule_reference: "RULE-003", rule_type: "duplicate_check", title: "Duplicate payment ID detection", description: "PAYMENT_ID must not be duplicated.", source_expression: null, target_expression: "GROUP BY PAYMENT_ID HAVING COUNT(*) > 1", validation_intent: "Duplicate detection", affected_tables: ["TGT_PAYMENTS_DW"], affected_columns: ["PAYMENT_ID"], severity: "high" },
    { ...base, rule_reference: "RULE-004", rule_type: "null_handling", title: "Required payment ID null check", description: "PAYMENT_ID is required.", source_expression: null, target_expression: "PAYMENT_ID IS NULL", validation_intent: "Null check", affected_tables: ["TGT_PAYMENTS_DW"], affected_columns: ["PAYMENT_ID"], severity: "critical" },
    { ...base, rule_reference: "RULE-005", rule_type: "transformation", title: "Payment status transformation", description: "PAID and SETTLED map to COMPLETED.", source_expression: "PAYMENT_STATUS IN ('PAID','SETTLED')", target_expression: "PAYMENT_STATUS = 'COMPLETED'", validation_intent: "Transformation validation", affected_tables: ["SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW"], affected_columns: ["PAYMENT_STATUS"], severity: "medium" },
    { ...base, rule_reference: "RULE-006", rule_type: "join", title: "Customer lookup join", description: "Customer IDs must resolve to DIM_CUSTOMER.", source_expression: "SRC_PAYMENTS_STG.CUSTOMER_ID = DIM_CUSTOMER.CUSTOMER_ID", target_expression: "TGT_PAYMENTS_DW.CUSTOMER_KEY = DIM_CUSTOMER.CUSTOMER_KEY", validation_intent: "Join validation", affected_tables: ["SRC_PAYMENTS_STG", "DIM_CUSTOMER", "TGT_PAYMENTS_DW"], affected_columns: ["CUSTOMER_ID", "CUSTOMER_KEY"], severity: "high" },
    { ...base, rule_reference: "RULE-007", rule_type: "filter", title: "Load date filter", description: "Validate LOAD_DT filter.", source_expression: "TRUNC(LOAD_DT) = :LOAD_DATE", target_expression: "TRUNC(LOAD_DT) = :LOAD_DATE", validation_intent: "Filter validation", affected_tables: ["SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW"], affected_columns: ["LOAD_DT"], severity: "medium" },
    { ...base, rule_reference: "RULE-008", rule_type: "audit", title: "Audit timestamp validation", description: "CREATED_AT and UPDATED_AT must be populated.", source_expression: null, target_expression: "CREATED_AT IS NOT NULL AND UPDATED_AT IS NOT NULL", validation_intent: "Audit field validation", affected_tables: ["TGT_PAYMENTS_DW"], affected_columns: ["CREATED_AT", "UPDATED_AT"], severity: "medium" },
  ];
}

function demoDataQualityChecks(analysisRunId: string, artifactId: string | null, projectId: string | null) {
  const base = { analysis_run_id: analysisRunId, artifact_id: artifactId, project_id: projectId, user_id: null, severity: "high", confidence_score: 92 };
  return [
    { ...base, check_type: "duplicate_check", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_ID", description: "Payment ID should not be duplicated.", expected_condition: "PAYMENT_ID is unique", suggested_validation: "GROUP BY PAYMENT_ID HAVING COUNT(*) > 1" },
    { ...base, check_type: "null_check", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_ID", description: "Payment ID is required.", expected_condition: "PAYMENT_ID IS NOT NULL", suggested_validation: "PAYMENT_ID IS NULL" },
    { ...base, check_type: "null_check", table_name: "TGT_PAYMENTS_DW", column_name: "CUSTOMER_ID", description: "Customer ID is required.", expected_condition: "CUSTOMER_ID IS NOT NULL", suggested_validation: "CUSTOMER_ID IS NULL" },
    { ...base, check_type: "primary_key_integrity", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_ID", description: "Payment ID primary key integrity.", expected_condition: "PAYMENT_ID is populated and unique", suggested_validation: "COUNT(*) - COUNT(DISTINCT PAYMENT_ID)" },
    { ...base, check_type: "sum_reconciliation", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_AMOUNT", description: "Payment amount totals reconcile.", expected_condition: "SUM difference is 0", suggested_validation: "SUM(PAYMENT_AMOUNT)" },
    { ...base, check_type: "transformation_output_check", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_STATUS", description: "Payment status transformation output is valid.", expected_condition: "PAID/SETTLED become COMPLETED", suggested_validation: "PAYMENT_STATUS mapping check" },
    { ...base, check_type: "date_validation", table_name: "TGT_PAYMENTS_DW", column_name: "PAYMENT_DATE_KEY", description: "Payment date key is YYYYMMDD.", expected_condition: "PAYMENT_DATE_KEY is numeric YYYYMMDD", suggested_validation: "LENGTH(PAYMENT_DATE_KEY) = 8" },
    { ...base, check_type: "referential_integrity", table_name: "TGT_PAYMENTS_DW", column_name: "CUSTOMER_KEY", description: "Customer key resolves to DIM_CUSTOMER.", expected_condition: "CUSTOMER_KEY exists in DIM_CUSTOMER", suggested_validation: "LEFT JOIN DIM_CUSTOMER" },
  ];
}

function oracleScripts() {
  return [
    script("row_count", "Row Count Reconciliation", "reconciliation", "row_count", "SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW", null, null, "Compare source and target row counts.", `
-- Validation: Row Count Reconciliation
-- Purpose: Compare source and target row counts for the same load date.
-- Source: SRC_PAYMENTS_STG
-- Target: TGT_PAYMENTS_DW
-- Expected Result: COUNT_DIFF should be 0.
-- Safety: Review table/schema names before execution.
-- Safety: Validate bind variables before execution.
-- Safety: Do not run against production without approval.
SELECT 'ROW_COUNT_CHECK' AS CHECK_NAME, SRC.SRC_COUNT, TGT.TGT_COUNT, TGT.TGT_COUNT - SRC.SRC_COUNT AS COUNT_DIFF
FROM (SELECT COUNT(*) AS SRC_COUNT FROM SRC_PAYMENTS_STG WHERE TRUNC(LOAD_DT) = :LOAD_DATE) SRC
CROSS JOIN (SELECT COUNT(*) AS TGT_COUNT FROM TGT_PAYMENTS_DW WHERE TRUNC(LOAD_DT) = :LOAD_DATE) TGT;`),
    script("duplicate", "Duplicate Payment ID Check", "data_quality", "duplicate_check", null, "TGT_PAYMENTS_DW", null, "PAYMENT_ID", "Detect duplicate payment IDs.", `
-- Validation: Duplicate Payment ID Check
-- Purpose: Detect duplicate PAYMENT_ID records in target table.
-- Target: TGT_PAYMENTS_DW
-- Expected Result: Query should return zero rows.
-- Safety: Review table/schema names before execution.
SELECT PAYMENT_ID, COUNT(*) AS DUPLICATE_COUNT
FROM TGT_PAYMENTS_DW
GROUP BY PAYMENT_ID
HAVING COUNT(*) > 1;`),
    script("null-payment-id", "Required PAYMENT_ID Null Check", "data_quality", "null_check", null, "TGT_PAYMENTS_DW", null, "PAYMENT_ID", "Verify PAYMENT_ID is populated.", `
-- Validation: Required PAYMENT_ID Null Check
-- Purpose: Verify required column PAYMENT_ID is not null.
-- Target: TGT_PAYMENTS_DW
-- Expected Result: NULL_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT 'PAYMENT_ID_NULL_CHECK' AS CHECK_NAME, COUNT(*) AS NULL_COUNT
FROM TGT_PAYMENTS_DW
WHERE PAYMENT_ID IS NULL;`),
    script("null-customer-id", "Required CUSTOMER_ID Null Check", "data_quality", "null_check", null, "TGT_PAYMENTS_DW", null, "CUSTOMER_ID", "Verify CUSTOMER_ID is populated.", `
-- Validation: Required CUSTOMER_ID Null Check
-- Purpose: Verify required column CUSTOMER_ID is not null.
-- Target: TGT_PAYMENTS_DW
-- Expected Result: NULL_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT 'CUSTOMER_ID_NULL_CHECK' AS CHECK_NAME, COUNT(*) AS NULL_COUNT
FROM TGT_PAYMENTS_DW
WHERE CUSTOMER_ID IS NULL;`),
    script("amount-sum", "Payment Amount Sum Reconciliation", "reconciliation", "sum_reconciliation", "SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW", "PAYMENT_AMOUNT", "PAYMENT_AMOUNT", "Compare payment amount totals.", `
-- Validation: Payment Amount Sum Reconciliation
-- Purpose: Compare source and target payment amount totals for the same load date.
-- Source: SRC_PAYMENTS_STG
-- Target: TGT_PAYMENTS_DW
-- Expected Result: AMOUNT_DIFF should be 0.
-- Safety: Review table/schema names before execution.
SELECT SRC.SRC_AMOUNT, TGT.TGT_AMOUNT, TGT.TGT_AMOUNT - SRC.SRC_AMOUNT AS AMOUNT_DIFF
FROM (SELECT NVL(SUM(PAYMENT_AMOUNT), 0) AS SRC_AMOUNT FROM SRC_PAYMENTS_STG WHERE TRUNC(LOAD_DT) = :LOAD_DATE) SRC
CROSS JOIN (SELECT NVL(SUM(PAYMENT_AMOUNT), 0) AS TGT_AMOUNT FROM TGT_PAYMENTS_DW WHERE TRUNC(LOAD_DT) = :LOAD_DATE) TGT;`),
    script("status-transform", "Payment Status Transformation Check", "transformation_check", "transformation_output", "SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW", "PAYMENT_STATUS", "PAYMENT_STATUS", "Validate payment status mapping.", `
-- Validation: Payment Status Transformation Check
-- Purpose: Confirm PAID and SETTLED source statuses become COMPLETED in target.
-- Source: SRC_PAYMENTS_STG
-- Target: TGT_PAYMENTS_DW
-- Expected Result: MISMATCH_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT COUNT(*) AS MISMATCH_COUNT
FROM SRC_PAYMENTS_STG SRC
JOIN TGT_PAYMENTS_DW TGT ON SRC.PAYMENT_ID = TGT.PAYMENT_ID
WHERE TRUNC(SRC.LOAD_DT) = :LOAD_DATE
  AND NVL(CASE WHEN SRC.PAYMENT_STATUS IN ('PAID','SETTLED') THEN 'COMPLETED' ELSE SRC.PAYMENT_STATUS END, '__NULL__') <> NVL(TGT.PAYMENT_STATUS, '__NULL__');`),
    script("customer-join", "Customer Lookup Join Validation", "transformation_check", "join_validation", "SRC_PAYMENTS_STG", "DIM_CUSTOMER", "CUSTOMER_ID", "CUSTOMER_KEY", "Validate customer lookup resolution.", `
-- Validation: Customer Lookup Join Validation
-- Purpose: Confirm source customer IDs resolve to DIM_CUSTOMER keys.
-- Source: SRC_PAYMENTS_STG
-- Target: DIM_CUSTOMER
-- Expected Result: UNMATCHED_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT COUNT(*) AS UNMATCHED_COUNT
FROM SRC_PAYMENTS_STG SRC
LEFT JOIN DIM_CUSTOMER DIM ON SRC.CUSTOMER_ID = DIM.CUSTOMER_ID
WHERE TRUNC(SRC.LOAD_DT) = :LOAD_DATE
  AND DIM.CUSTOMER_KEY IS NULL;`),
    script("date-key", "Payment Date Key Transformation Check", "transformation_check", "date_validation", "SRC_PAYMENTS_STG", "TGT_PAYMENTS_DW", "PAYMENT_DATE", "PAYMENT_DATE_KEY", "Validate YYYYMMDD date key.", `
-- Validation: Payment Date Key Transformation Check
-- Purpose: Confirm PAYMENT_DATE is transformed to numeric YYYYMMDD key.
-- Source: SRC_PAYMENTS_STG
-- Target: TGT_PAYMENTS_DW
-- Expected Result: MISMATCH_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT COUNT(*) AS MISMATCH_COUNT
FROM SRC_PAYMENTS_STG SRC
JOIN TGT_PAYMENTS_DW TGT ON SRC.PAYMENT_ID = TGT.PAYMENT_ID
WHERE TRUNC(SRC.LOAD_DT) = :LOAD_DATE
  AND TO_NUMBER(TO_CHAR(SRC.PAYMENT_DATE, 'YYYYMMDD')) <> TGT.PAYMENT_DATE_KEY;`),
    script("pk", "Primary Key Integrity Check", "data_quality", "primary_key_integrity", null, "TGT_PAYMENTS_DW", null, "PAYMENT_ID", "Validate target payment key integrity.", `
-- Validation: Primary Key Integrity Check
-- Purpose: Confirm PAYMENT_ID is populated and unique.
-- Target: TGT_PAYMENTS_DW
-- Expected Result: NULL_KEY_COUNT and DUPLICATE_KEY_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT COUNT(*) AS TOTAL_ROWS,
       SUM(CASE WHEN PAYMENT_ID IS NULL THEN 1 ELSE 0 END) AS NULL_KEY_COUNT,
       COUNT(*) - COUNT(DISTINCT PAYMENT_ID) AS DUPLICATE_KEY_COUNT
FROM TGT_PAYMENTS_DW;`),
    script("audit", "Audit Timestamp Check", "audit_check", "audit_balance", null, "TGT_PAYMENTS_DW", null, "CREATED_AT", "Validate audit timestamps.", `
-- Validation: Audit Timestamp Check
-- Purpose: Confirm CREATED_AT and UPDATED_AT are populated.
-- Target: TGT_PAYMENTS_DW
-- Expected Result: MISSING_AUDIT_COUNT should be 0.
-- Safety: Review table/schema names before execution.
SELECT COUNT(*) AS MISSING_AUDIT_COUNT
FROM TGT_PAYMENTS_DW
WHERE CREATED_AT IS NULL OR UPDATED_AT IS NULL;`),
  ];
}

function script(key: string, scriptName: string, scriptType: string, category: string, sourceTable: string | null, targetTable: string | null, sourceColumn: string | null, targetColumn: string | null, description: string, sqlText: string) {
  return {
    key,
    script_name: scriptName,
    script_type: scriptType,
    validation_category: category,
    source_table: sourceTable,
    target_table: targetTable,
    source_column: sourceColumn,
    target_column: targetColumn,
    description,
    sql_text: sqlText,
  };
}

function resultPlans(): ResultPlan[] {
  return [
    { scriptName: "Row Count Reconciliation", status: "passed", actualResult: "COUNT_DIFF = 0", rowCount: 1000, differenceCount: 0, evidenceNotes: "Source and target row counts match." },
    { scriptName: "Duplicate Payment ID Check", status: "failed", actualResult: "Query returned duplicate PAYMENT_ID values", differenceCount: 3, errorMessage: "Duplicate PAYMENT_ID records detected in TGT_PAYMENTS_DW", evidenceNotes: "Duplicate failures attached for review." },
    { scriptName: "Required PAYMENT_ID Null Check", status: "passed", actualResult: "NULL_COUNT = 0", differenceCount: 0, evidenceNotes: "No null PAYMENT_ID values found." },
    { scriptName: "Required CUSTOMER_ID Null Check", status: "passed", actualResult: "NULL_COUNT = 0", differenceCount: 0, evidenceNotes: "No null CUSTOMER_ID values found." },
    { scriptName: "Payment Amount Sum Reconciliation", status: "warning", actualResult: "Amount difference detected but within investigation threshold", differenceAmount: 24.75, evidenceNotes: "Difference requires business review due to rounding rule." },
    { scriptName: "Payment Status Transformation Check", status: "passed", actualResult: "MISMATCH_COUNT = 0", differenceCount: 0, evidenceNotes: "Status transformation matched expected mapping." },
    { scriptName: "Customer Lookup Join Validation", status: "failed", actualResult: "12 payment records do not resolve to DIM_CUSTOMER.CUSTOMER_KEY", differenceCount: 12, errorMessage: "Customer lookup join validation failed", evidenceNotes: "Unmatched customer records attached." },
    { scriptName: "Payment Date Key Transformation Check", status: "passed", actualResult: "MISMATCH_COUNT = 0", differenceCount: 0, evidenceNotes: "Date key transformation is valid." },
    { scriptName: "Primary Key Integrity Check", status: "passed", actualResult: "NULL_KEY_COUNT = 0 and DUPLICATE_KEY_COUNT = 0", differenceCount: 0, evidenceNotes: "Primary key integrity passed." },
    { scriptName: "Audit Timestamp Check", status: "passed", actualResult: "MISSING_AUDIT_COUNT = 0", differenceCount: 0, evidenceNotes: "Audit timestamps are populated." },
  ];
}

function evidenceFiles() {
  return [
    { scriptName: "Row Count Reconciliation", fileName: "row_count_reconciliation_result.csv", type: "query_result_csv", notes: "Row count matched.", content: "CHECK_NAME,SRC_COUNT,TGT_COUNT,COUNT_DIFF\nROW_COUNT_CHECK,1000,1000,0\n" },
    { scriptName: "Duplicate Payment ID Check", fileName: "duplicate_payment_id_failures.csv", type: "query_result_csv", notes: "Duplicate payment IDs found.", content: "PAYMENT_ID,DUPLICATE_COUNT\nPAY-1007,2\nPAY-2041,2\nPAY-3018,2\n" },
    { scriptName: "Customer Lookup Join Validation", fileName: "customer_lookup_unmatched_records.csv", type: "query_result_csv", notes: "Unmatched customer records require dimension review.", content: "PAYMENT_ID,CUSTOMER_ID\nPAY-811,CUST-404\nPAY-812,CUST-405\n" },
    { scriptName: "Payment Amount Sum Reconciliation", fileName: "amount_reconciliation_warning.txt", type: "manual_note", notes: "Rounding difference requires review.", content: "Amount difference was 24.75 and appears related to rounding rules.\n" },
    { scriptName: "Audit Timestamp Check", fileName: "audit_timestamp_pass.txt", type: "manual_note", notes: "Audit timestamp query passed.", content: "MISSING_AUDIT_COUNT = 0\n" },
  ];
}

function generateAuditMarkdown(run: Record<string, unknown>, results: Record<string, unknown>[], scripts: ScriptRow[], evidence: Record<string, unknown>[]) {
  const passRate = Math.round((7 / 10) * 100);
  return `# ETL Validation Audit Report

## 1. Executive Summary
ETL QAplanet generated Oracle validation scripts, created an execution run, captured results, attached evidence, and prepared an audit-ready package for the Payments DW workflow.

## 2. Execution Summary
- Run Name: ${String(run?.run_name ?? demoRunName)}
- Environment: QA
- Database: Oracle
- Total Scripts: 10
- Passed: 7
- Failed: 2
- Warnings: 1
- Skipped: 0
- Pass Rate: ${passRate}%

## 3. Validation Scope
- Source Tables: SRC_PAYMENTS_STG, SRC_CUSTOMERS_STG
- Target Tables: TGT_PAYMENTS_DW, DIM_CUSTOMER

## 4. Script Inventory
| Script | Category | Source | Target | Status |
|---|---|---|---|---|
${scripts.map((script) => `| ${script.script_name} | ${script.validation_category} | ${script.source_table ?? ""} | ${script.target_table ?? ""} | ready |`).join("\n")}

## 5. Execution Results
| Script | Status | Actual Result | Evidence |
|---|---|---|---|
${results.map((result) => `| ${String(result.script_name ?? "")} | ${String(result.status ?? "")} | ${String(result.actual_result ?? "")} | ${evidence.filter((file) => file.execution_result_id === result.id).length} file(s) |`).join("\n")}

## 6. Failed Validations
- Duplicate Payment ID Check: Duplicate PAYMENT_ID records detected in TGT_PAYMENTS_DW.
- Customer Lookup Join Validation: 12 payment records do not resolve to DIM_CUSTOMER.CUSTOMER_KEY.

## 7. Evidence Summary
${evidence.map((file) => `- ${String(file.file_name ?? "")}: ${String(file.notes ?? "")}`).join("\n")}

## 8. Recommendations
- Investigate duplicate payment IDs before downstream reporting.
- Review unmatched customer records and update dimension load or lookup rule.
- Confirm rounding tolerance for payment amount reconciliation.
- Re-run validation after remediation.

## 9. Appendix
SQL inventory and traceability references are included in the full validation package.
`;
}

function buildPackageReadme() {
  return `# Payments DW Oracle Full Validation Package

Generated by ETL QAplanet.

Database type: Oracle
Environment: QA

## Purpose
This package demonstrates end-to-end ETL validation readiness, including generated SELECT-only Oracle SQL, execution results, evidence, an audit report, and a package manifest.

## How to review scripts
1. Review table, schema, and column names.
2. Confirm bind variables such as :LOAD_DATE.
3. Run only in an approved validation environment.
4. Compare query output to expected result comments.

Safety note: Review generated SQL before running against any controlled or production environment.
`;
}

function createCsv(rows: Array<Array<string>>) {
  return rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function expectedResult(category: string) {
  if (category === "row_count") return "COUNT_DIFF should be 0.";
  if (category === "duplicate_check") return "Query should return zero duplicate rows.";
  if (category === "null_check") return "NULL_COUNT should be 0.";
  if (category === "primary_key_integrity") return "Null and duplicate key counts should be 0.";
  if (category === "sum_reconciliation") return "AMOUNT_DIFF should be 0 or within approved tolerance.";
  return "Query should return zero exceptions or a zero difference.";
}

function categoryFolder(category: string) {
  if (category === "row_count") return "row-count";
  if (category === "duplicate_check") return "duplicate-checks";
  if (category === "null_check") return "null-checks";
  if (category === "sum_reconciliation") return "reconciliation";
  if (category === "join_validation") return "join-validation";
  if (category === "audit_balance") return "audit";
  if (category.includes("transformation") || category === "date_validation") return "transformations";
  return "other";
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "etl-qaplanet";
}

void main();
