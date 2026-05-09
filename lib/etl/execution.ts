import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import { getSqlSnapshot, type ValidationScript } from "@/lib/etl/sql";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type ExecutionRunStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "completed_with_failures"
  | "failed"
  | "cancelled";

export type ExecutionResultStatus = "not_run" | "passed" | "failed" | "warning" | "skipped" | "needs_review";
export type ExecutionMethod = "manual" | "imported_results" | "future_database_connection";

export type ExecutionRun = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  analysis_run_id: string | null;
  validation_pack_id: string | null;
  run_name: string;
  database_type: string | null;
  environment_name: string | null;
  execution_method: ExecutionMethod;
  status: ExecutionRunStatus;
  total_scripts: number;
  passed_count: number;
  failed_count: number;
  warning_count: number;
  skipped_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionResult = {
  id: string;
  execution_run_id: string | null;
  script_id: string | null;
  project_id: string | null;
  user_id: string | null;
  script_name: string | null;
  validation_category: string | null;
  source_table: string | null;
  target_table: string | null;
  status: ExecutionResultStatus;
  expected_result: string | null;
  actual_result: string | null;
  row_count: number | null;
  difference_count: number | null;
  difference_amount: number | null;
  error_message: string | null;
  evidence_notes: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceFile = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  execution_run_id: string | null;
  execution_result_id: string | null;
  script_id: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  evidence_type: string | null;
  notes: string | null;
  uploaded_at: string;
  created_at: string;
};

export type AuditReport = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  execution_run_id: string | null;
  validation_pack_id: string | null;
  report_name: string;
  report_type: string;
  report_content: string | null;
  file_name: string | null;
  storage_path: string | null;
  created_at: string;
};

export type ExecutionSnapshot = {
  configured: boolean;
  runs: ExecutionRun[];
  results: ExecutionResult[];
  evidence: EvidenceFile[];
  reports: AuditReport[];
  counts: ExecutionCounts;
  latestRun: ExecutionRun | null;
  error?: string;
};

export type ExecutionCounts = {
  runs: number;
  passed: number;
  failed: number;
  warnings: number;
  needsReview: number;
  evidenceFiles: number;
  auditReports: number;
};

export type CreateExecutionRunRequest = {
  projectId?: string | null;
  validationPackId?: string | null;
  scriptIds?: string[];
  runName: string;
  databaseType?: string | null;
  environmentName?: string | null;
  executionMethod?: ExecutionMethod;
};

export type UpdateExecutionResultRequest = {
  status?: ExecutionResultStatus;
  actualResult?: string | null;
  rowCount?: number | null;
  differenceCount?: number | null;
  differenceAmount?: number | null;
  errorMessage?: string | null;
  evidenceNotes?: string | null;
};

export type ImportedExecutionResult = {
  script_name: string;
  status: ExecutionResultStatus;
  actual_result?: string | null;
  row_count?: number | null;
  difference_count?: number | null;
  difference_amount?: number | null;
  error_message?: string | null;
  evidence_notes?: string | null;
};

export type ImportExecutionResultsRequest = {
  projectId?: string | null;
  runName?: string | null;
  databaseType?: string | null;
  environmentName?: string | null;
  results: ImportedExecutionResult[];
};

const allowedResultStatuses: ExecutionResultStatus[] = ["not_run", "passed", "failed", "warning", "skipped", "needs_review"];

export function emptyExecutionCounts(): ExecutionCounts {
  return {
    runs: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    needsReview: 0,
    evidenceFiles: 0,
    auditReports: 0,
  };
}

export async function getExecutionSnapshot(filters?: {
  projectId?: string | null;
  executionRunId?: string | null;
}): Promise<ExecutionSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      runs: [],
      results: [],
      evidence: [],
      reports: [],
      counts: emptyExecutionCounts(),
      latestRun: null,
      error: "Supabase is not configured.",
    };
  }

  try {
    const supabase = getSupabaseOrThrow();
    let runQuery = supabase.from("etl_execution_runs").select("*");
    let resultQuery = supabase.from("etl_execution_results").select("*");
    let evidenceQuery = supabase.from("etl_evidence_files").select("*");
    let reportQuery = supabase.from("etl_audit_reports").select("*");

    if (filters?.projectId) {
      runQuery = runQuery.eq("project_id", filters.projectId);
      resultQuery = resultQuery.eq("project_id", filters.projectId);
      evidenceQuery = evidenceQuery.eq("project_id", filters.projectId);
      reportQuery = reportQuery.eq("project_id", filters.projectId);
    }

    if (filters?.executionRunId) {
      resultQuery = resultQuery.eq("execution_run_id", filters.executionRunId);
      evidenceQuery = evidenceQuery.eq("execution_run_id", filters.executionRunId);
      reportQuery = reportQuery.eq("execution_run_id", filters.executionRunId);
    }

    const [runResult, executionResult, evidenceResult, reportResult] = await Promise.all([
      runQuery.order("created_at", { ascending: false }).limit(100),
      resultQuery.order("created_at", { ascending: true }).limit(2000),
      evidenceQuery.order("created_at", { ascending: false }).limit(1000),
      reportQuery.order("created_at", { ascending: false }).limit(100),
    ]);

    const firstError = runResult.error ?? executionResult.error ?? evidenceResult.error ?? reportResult.error;
    if (firstError) throw new Error(firstError.message);

    const runs = (runResult.data ?? []) as ExecutionRun[];
    const results = (executionResult.data ?? []) as ExecutionResult[];
    const evidence = (evidenceResult.data ?? []) as EvidenceFile[];
    const reports = (reportResult.data ?? []) as AuditReport[];

    return {
      configured: true,
      runs,
      results,
      evidence,
      reports,
      latestRun: runs[0] ?? null,
      counts: calculateExecutionCounts(runs, results, evidence, reports),
    };
  } catch (error) {
    return {
      configured: true,
      runs: [],
      results: [],
      evidence: [],
      reports: [],
      latestRun: null,
      counts: emptyExecutionCounts(),
      error: error instanceof Error ? error.message : "Execution tracking data could not be loaded.",
    };
  }
}

export async function getExecutionRunDetails(id: string) {
  const snapshot = await getExecutionSnapshot({ executionRunId: id });
  const run = snapshot.runs.find((item) => item.id === id) ?? await fetchSingleRun(id);
  const results = snapshot.results.filter((item) => item.execution_run_id === id);
  const evidence = snapshot.evidence.filter((item) => item.execution_run_id === id);
  const reports = snapshot.reports.filter((item) => item.execution_run_id === id);

  return {
    run,
    results,
    evidence,
    reports,
  };
}

export async function createExecutionRun(request: CreateExecutionRunRequest, userId: string) {
  const supabase = getSupabaseOrThrow();
  const scripts = await resolveExecutionScripts(request);

  if (scripts.length === 0) {
    throw new Error("No generated validation scripts are available for this execution run.");
  }

  const databaseType = request.databaseType || scripts[0]?.database_type || "oracle";
  const { data: run, error: runError } = await supabase
    .from("etl_execution_runs")
    .insert({
      project_id: request.projectId ?? null,
      user_id: userId,
      analysis_run_id: scripts[0]?.analysis_run_id ?? null,
      validation_pack_id: request.validationPackId ?? null,
      run_name: request.runName?.trim() || `ETL Validation Run ${new Date().toLocaleDateString("en")}`,
      database_type: databaseType,
      environment_name: request.environmentName?.trim() || "QA",
      execution_method: request.executionMethod ?? "manual",
      status: "not_started",
      total_scripts: scripts.length,
    })
    .select("*")
    .single();

  if (runError || !run) throw new Error(runError?.message ?? "Execution run could not be created.");

  const resultRows = scripts.map((script) => ({
    execution_run_id: run.id,
    script_id: script.id,
    project_id: request.projectId ?? script.project_id ?? null,
    user_id: userId,
    script_name: script.script_name,
    validation_category: script.validation_category,
    source_table: script.source_table,
    target_table: script.target_table,
    status: "not_run" as ExecutionResultStatus,
    expected_result: expectedResultForScript(script),
  }));

  const { data: results, error: resultError } = await supabase
    .from("etl_execution_results")
    .insert(resultRows)
    .select("*");

  if (resultError) throw new Error(resultError.message);

  return {
    run: run as ExecutionRun,
    results: (results ?? []) as ExecutionResult[],
  };
}

export async function updateExecutionResult(id: string, request: UpdateExecutionResultRequest) {
  const supabase = getSupabaseOrThrow();
  const status = normalizeExecutionResultStatus(request.status);
  const patch = {
    status,
    actual_result: request.actualResult ?? null,
    row_count: normalizeNumber(request.rowCount),
    difference_count: normalizeNumber(request.differenceCount),
    difference_amount: normalizeNumber(request.differenceAmount),
    error_message: request.errorMessage ?? null,
    evidence_notes: request.evidenceNotes ?? null,
    executed_at: status === "not_run" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("etl_execution_results")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Execution result could not be updated.");

  await refreshExecutionRunSummary((data as ExecutionResult).execution_run_id);

  return data as ExecutionResult;
}

export async function importExecutionResults(request: ImportExecutionResultsRequest, userId: string) {
  const supabase = getSupabaseOrThrow();
  const imported = request.results.map(normalizeImportedResult).filter(Boolean) as ImportedExecutionResult[];
  if (imported.length === 0) throw new Error("Imported results must include at least one script_name and status.");

  const scripts = (await getSqlSnapshot({ projectId: request.projectId, databaseType: request.databaseType })).scripts;
  const scriptByName = new Map(scripts.map((script) => [script.script_name.toLowerCase(), script]));

  const { data: run, error: runError } = await supabase
    .from("etl_execution_runs")
    .insert({
      project_id: request.projectId ?? null,
      user_id: userId,
      analysis_run_id: scripts[0]?.analysis_run_id ?? null,
      run_name: request.runName?.trim() || `Imported ETL Results ${new Date().toLocaleDateString("en")}`,
      database_type: request.databaseType || scripts[0]?.database_type || "oracle",
      environment_name: request.environmentName?.trim() || "QA",
      execution_method: "imported_results",
      status: "in_progress",
      total_scripts: imported.length,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (runError || !run) throw new Error(runError?.message ?? "Imported execution run could not be created.");

  const rows = imported.map((item) => {
    const script = scriptByName.get(item.script_name.toLowerCase());
    return {
      execution_run_id: run.id,
      script_id: script?.id ?? null,
      project_id: request.projectId ?? script?.project_id ?? null,
      user_id: userId,
      script_name: item.script_name,
      validation_category: script?.validation_category ?? null,
      source_table: script?.source_table ?? null,
      target_table: script?.target_table ?? null,
      status: item.status,
      expected_result: script ? expectedResultForScript(script) : "Imported result could not be matched to a generated script.",
      actual_result: item.actual_result ?? null,
      row_count: normalizeNumber(item.row_count),
      difference_count: normalizeNumber(item.difference_count),
      difference_amount: normalizeNumber(item.difference_amount),
      error_message: item.error_message ?? null,
      evidence_notes: script ? item.evidence_notes ?? null : `${item.evidence_notes ?? ""} Script was not found in generated SQL inventory.`.trim(),
      executed_at: item.status === "not_run" ? null : new Date().toISOString(),
    };
  });

  const { data: results, error: resultError } = await supabase.from("etl_execution_results").insert(rows).select("*");
  if (resultError) throw new Error(resultError.message);

  await refreshExecutionRunSummary(run.id);
  const updatedRun = await fetchSingleRun(run.id);

  return {
    run: updatedRun,
    results: (results ?? []) as ExecutionResult[],
    unmatched: rows.filter((row) => !row.script_id).length,
  };
}

export function parseImportedExecutionResults(input: string): ImportExecutionResultsRequest {
  const value = input.trim();
  if (!value) throw new Error("Paste JSON or CSV execution results before importing.");

  if (value.startsWith("{") || value.startsWith("[")) {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return { results: parsed.map(toImportedResultFromRecord).filter(Boolean) as ImportedExecutionResult[] };
    }

    const record = asRecord(parsed);
    const rawResults = Array.isArray(record.results) ? record.results : [];
    return {
      runName: stringValue(record.run_name ?? record.runName),
      databaseType: stringValue(record.database_type ?? record.databaseType),
      environmentName: stringValue(record.environment_name ?? record.environmentName),
      results: rawResults.map(toImportedResultFromRecord).filter(Boolean) as ImportedExecutionResult[],
    };
  }

  const [headerLine, ...lines] = value.split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(headerLine).map((header) => header.trim());
  return {
    results: lines.map((line) => {
      const cells = splitCsvLine(line);
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? "";
      });
      return toImportedResultFromRecord(record);
    }).filter(Boolean) as ImportedExecutionResult[],
  };
}

export function calculateExecutionCounts(
  runs: ExecutionRun[],
  results: ExecutionResult[],
  evidence: EvidenceFile[],
  reports: AuditReport[],
): ExecutionCounts {
  return {
    runs: runs.length,
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status === "failed").length,
    warnings: results.filter((item) => item.status === "warning").length,
    needsReview: results.filter((item) => item.status === "needs_review").length,
    evidenceFiles: evidence.length,
    auditReports: reports.length,
  };
}

export function normalizeExecutionResultStatus(status?: string | null): ExecutionResultStatus {
  const normalized = String(status ?? "not_run").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return allowedResultStatuses.includes(normalized as ExecutionResultStatus)
    ? normalized as ExecutionResultStatus
    : "needs_review";
}

async function resolveExecutionScripts(request: CreateExecutionRunRequest) {
  const supabase = getSupabaseOrThrow();

  if (request.scriptIds && request.scriptIds.length > 0) {
    const { data, error } = await supabase
      .from("etl_validation_scripts")
      .select("*")
      .in("id", request.scriptIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ValidationScript[];
  }

  if (request.validationPackId) {
    const { data: links, error: linkError } = await supabase
      .from("etl_validation_pack_scripts")
      .select("script_id")
      .eq("pack_id", request.validationPackId);
    if (linkError) throw new Error(linkError.message);
    const ids = (links ?? []).map((link) => link.script_id).filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("etl_validation_scripts").select("*").in("id", ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as ValidationScript[];
  }

  return (await getSqlSnapshot({ projectId: request.projectId, databaseType: request.databaseType })).scripts;
}

async function refreshExecutionRunSummary(runId?: string | null) {
  if (!runId) return;
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.from("etl_execution_results").select("*").eq("execution_run_id", runId);
  if (error) throw new Error(error.message);

  const results = (data ?? []) as ExecutionResult[];
  const summary = calculateExecutionSummary(results);
  const status = deriveRunStatus(results);

  const { error: updateError } = await supabase
    .from("etl_execution_runs")
    .update({
      total_scripts: results.length,
      passed_count: summary.passed,
      failed_count: summary.failed,
      warning_count: summary.warning,
      skipped_count: summary.skipped,
      status,
      completed_at: ["completed", "completed_with_failures", "failed"].includes(status) ? new Date().toISOString() : null,
      started_at: results.some((item) => item.status !== "not_run") ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (updateError) throw new Error(updateError.message);
}

function calculateExecutionSummary(results: ExecutionResult[]) {
  return {
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status === "failed").length,
    warning: results.filter((item) => item.status === "warning").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    needsReview: results.filter((item) => item.status === "needs_review").length,
    notRun: results.filter((item) => item.status === "not_run").length,
  };
}

function deriveRunStatus(results: ExecutionResult[]): ExecutionRunStatus {
  if (results.length === 0) return "not_started";
  const summary = calculateExecutionSummary(results);
  if (summary.notRun === results.length) return "not_started";
  if (summary.notRun > 0) return "in_progress";
  if (summary.failed > 0 || summary.needsReview > 0) return "completed_with_failures";
  return "completed";
}

async function fetchSingleRun(id: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.from("etl_execution_runs").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Execution run could not be loaded.");
  return data as ExecutionRun;
}

function expectedResultForScript(script: ValidationScript) {
  if (script.validation_category === "row_count") return "COUNT_DIFF should be 0.";
  if (script.validation_category === "duplicate_check") return "Query should return zero duplicate rows.";
  if (script.validation_category === "null_check") return "NULL_COUNT should be 0.";
  if (script.validation_category === "primary_key_integrity") return "Duplicate and null key counts should be 0.";
  return "Query should return zero exceptions or a zero difference.";
}

function normalizeImportedResult(record: ImportedExecutionResult) {
  if (!record.script_name?.trim()) return null;
  return {
    ...record,
    script_name: record.script_name.trim(),
    status: normalizeExecutionResultStatus(record.status),
  };
}

function toImportedResultFromRecord(value: unknown): ImportedExecutionResult | null {
  const record = asRecord(value);
  const scriptName = stringValue(record.script_name ?? record.scriptName);
  if (!scriptName) return null;

  return {
    script_name: scriptName,
    status: normalizeExecutionResultStatus(stringValue(record.status)),
    actual_result: stringValue(record.actual_result ?? record.actualResult),
    row_count: normalizeNumber(record.row_count ?? record.rowCount),
    difference_count: normalizeNumber(record.difference_count ?? record.differenceCount),
    difference_amount: normalizeNumber(record.difference_amount ?? record.differenceAmount),
    error_message: stringValue(record.error_message ?? record.errorMessage),
    evidence_notes: stringValue(record.evidence_notes ?? record.evidenceNotes),
  };
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
