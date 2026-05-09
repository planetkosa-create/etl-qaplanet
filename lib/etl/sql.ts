import JSZip from "jszip";
import { getAnalysisSnapshot } from "@/lib/etl/analysis";
import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  exportTypes,
  generateValidationScriptsFromAnalysis,
  normalizeDatabaseType,
  type DatabaseType,
  type ExecutionStatus,
  type ExportType,
  type PackType,
  type ScriptType,
  type ValidationCategory,
} from "@/lib/etl/sql-generator";

export type ValidationScript = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  analysis_run_id: string | null;
  script_name: string;
  script_type: ScriptType;
  database_type: DatabaseType;
  validation_category: ValidationCategory;
  source_table: string | null;
  target_table: string | null;
  source_column: string | null;
  target_column: string | null;
  sql_text: string;
  description: string | null;
  generated_from: string | null;
  confidence_score: number | null;
  execution_status: ExecutionStatus;
  created_at: string;
  updated_at: string;
};

export type ValidationPack = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  analysis_run_id: string | null;
  pack_name: string;
  pack_type: PackType;
  description: string | null;
  script_count: number;
  database_type: DatabaseType | null;
  created_at: string;
  updated_at: string;
};

export type ScriptExport = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  pack_id: string | null;
  export_type: ExportType;
  file_name: string;
  file_content: string | null;
  storage_path: string | null;
  created_at: string;
};

export type SqlSnapshot = {
  configured: boolean;
  scripts: ValidationScript[];
  packs: ValidationPack[];
  counts: SqlCounts;
  latestScript: ValidationScript | null;
  error?: string;
};

export type SqlCounts = {
  scripts: number;
  packs: number;
  oracleStatements: number;
  reconciliationScripts: number;
  dataQualityScripts: number;
  readyScripts: number;
  needsMappingReview: number;
  manualReview: number;
};

export type GenerateSqlRequest = {
  projectId?: string | null;
  analysisRunId?: string | null;
  databaseType?: string | null;
  categories?: string[];
  mode?: "selected" | "all";
};

export type ExportRequest = {
  projectId?: string | null;
  packId?: string | null;
  scriptIds?: string[];
  exportType: ExportType;
};

const packDefinitions: Array<{
  packName: string;
  packType: PackType;
  description: string;
  categories: ValidationCategory[];
}> = [
  {
    packName: "Row Count Reconciliation",
    packType: "row_count_reconciliation",
    description: "Source-to-target row count validation scripts.",
    categories: ["row_count"],
  },
  {
    packName: "Sum/Amount Validation",
    packType: "sum_amount_validation",
    description: "Amount and control total reconciliation scripts.",
    categories: ["sum_reconciliation", "amount_reconciliation", "audit_balance"],
  },
  {
    packName: "Duplicate Detection",
    packType: "duplicate_detection",
    description: "Duplicate and repeated-key detection scripts.",
    categories: ["duplicate_check"],
  },
  {
    packName: "Primary Key Integrity",
    packType: "primary_key_integrity",
    description: "Primary key uniqueness and population checks.",
    categories: ["primary_key_integrity"],
  },
  {
    packName: "Null Handling Validation",
    packType: "null_handling_validation",
    description: "Required field and null-safety validation scripts.",
    categories: ["null_check"],
  },
  {
    packName: "Transformation Logic Checks",
    packType: "transformation_logic_checks",
    description: "Transformation, join, filter, and aggregation checks.",
    categories: ["transformation_output", "join_validation", "filter_validation", "aggregation_check"],
  },
  {
    packName: "Full Validation Suite",
    packType: "full_validation_suite",
    description: "All generated validation scripts for this analysis run.",
    categories: [],
  },
];

export function emptySqlCounts(): SqlCounts {
  return {
    scripts: 0,
    packs: 0,
    oracleStatements: 0,
    reconciliationScripts: 0,
    dataQualityScripts: 0,
    readyScripts: 0,
    needsMappingReview: 0,
    manualReview: 0,
  };
}

export async function getSqlSnapshot(filters?: {
  projectId?: string | null;
  analysisRunId?: string | null;
  databaseType?: string | null;
  validationCategory?: string | null;
}): Promise<SqlSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      scripts: [],
      packs: [],
      latestScript: null,
      counts: emptySqlCounts(),
      error: "Supabase is not configured.",
    };
  }

  try {
    const supabase = getSupabaseOrThrow();
    let scriptQuery = supabase.from("etl_validation_scripts").select("*");
    let packQuery = supabase.from("etl_validation_packs").select("*");

    if (filters?.projectId) {
      scriptQuery = scriptQuery.eq("project_id", filters.projectId);
      packQuery = packQuery.eq("project_id", filters.projectId);
    }
    if (filters?.analysisRunId) {
      scriptQuery = scriptQuery.eq("analysis_run_id", filters.analysisRunId);
      packQuery = packQuery.eq("analysis_run_id", filters.analysisRunId);
    }
    if (filters?.databaseType) {
      scriptQuery = scriptQuery.eq("database_type", normalizeDatabaseType(filters.databaseType));
      packQuery = packQuery.eq("database_type", normalizeDatabaseType(filters.databaseType));
    }
    if (filters?.validationCategory) {
      scriptQuery = scriptQuery.eq("validation_category", filters.validationCategory);
    }

    const [scriptResult, packResult] = await Promise.all([
      scriptQuery.order("created_at", { ascending: false }).limit(1000),
      packQuery.order("created_at", { ascending: false }).limit(100),
    ]);

    const firstError = scriptResult.error ?? packResult.error;
    if (firstError) throw new Error(firstError.message);

    const scripts = ((scriptResult.data ?? []) as ValidationScript[]).map(normalizeScriptConfidence);
    const packs = (packResult.data ?? []) as ValidationPack[];

    return {
      configured: true,
      scripts,
      packs,
      latestScript: scripts[0] ?? null,
      counts: buildSqlCounts(scripts, packs),
    };
  } catch (error) {
    return {
      configured: true,
      scripts: [],
      packs: [],
      latestScript: null,
      counts: emptySqlCounts(),
      error: error instanceof Error ? error.message : "Generated SQL data could not be loaded.",
    };
  }
}

export async function generateAndSaveValidationSql(request: GenerateSqlRequest, userId: string) {
  const supabase = getSupabaseOrThrow();
  const analysis = await getAnalysisSnapshot();
  const analysisRunId = request.analysisRunId || analysis.latestRun?.id || null;

  if (!analysis.latestRun && !request.analysisRunId) {
    throw new Error("No ETL analysis results found. Run Mapping Analysis and Rule Extraction before generating validation SQL.");
  }

  const filtered = analysisRunId
    ? {
        mappings: analysis.mappings.filter((item) => item.analysis_run_id === analysisRunId),
        rules: analysis.rules.filter((item) => item.analysis_run_id === analysisRunId),
        dataQualityChecks: analysis.dataQualityChecks.filter((item) => item.analysis_run_id === analysisRunId),
      }
    : {
        mappings: analysis.mappings,
        rules: analysis.rules,
        dataQualityChecks: analysis.dataQualityChecks,
      };

  const generated = generateValidationScriptsFromAnalysis({
    ...filtered,
    databaseType: request.databaseType || "oracle",
    categories: request.mode === "all" ? [] : request.categories,
  });

  if (generated.length === 0) {
    throw new Error("No validation scripts could be generated from the current analysis results.");
  }

  const rows = generated
    .filter((script) => script.execution_status !== "failed_validation")
    .map((script) => ({
      ...script,
      project_id: request.projectId ?? null,
      user_id: userId,
      analysis_run_id: analysisRunId,
    }));

  if (rows.length === 0) {
    throw new Error("Generated SQL contains a restricted statement and was not saved.");
  }

  await removeRegeneratedScriptDuplicates({
    analysisRunId,
    databaseType: normalizeDatabaseType(request.databaseType),
    generatedFrom: rows.map((script) => script.generated_from).filter(Boolean),
    categories: rows.map((script) => script.validation_category),
  });

  const { error } = await supabase
    .from("etl_validation_scripts")
    .insert(rows);

  if (error) throw new Error(error.message);

  const allScriptsForRun = (await getSqlSnapshot({
    analysisRunId,
    databaseType: request.databaseType,
  })).scripts;

  await removeValidationPacksForScope({
    analysisRunId,
    databaseType: normalizeDatabaseType(request.databaseType),
  });

  const packs = await generateValidationPacksForScripts({
    projectId: request.projectId ?? null,
    userId,
    analysisRunId,
    databaseType: normalizeDatabaseType(request.databaseType),
    scripts: allScriptsForRun,
  });

  return {
    scripts: allScriptsForRun,
    packs,
    counts: buildSqlCounts(allScriptsForRun, packs),
  };
}

export async function generateValidationPacksForScripts(input: {
  projectId?: string | null;
  userId: string;
  analysisRunId?: string | null;
  databaseType: DatabaseType;
  scripts?: ValidationScript[];
}) {
  const supabase = getSupabaseOrThrow();
  const scripts = input.scripts ?? (await getSqlSnapshot({ analysisRunId: input.analysisRunId, databaseType: input.databaseType })).scripts;
  const createdPacks: ValidationPack[] = [];

  for (const definition of packDefinitions) {
    const matchingScripts = definition.categories.length === 0
      ? scripts
      : scripts.filter((script) => definition.categories.includes(script.validation_category));

    if (matchingScripts.length === 0) continue;

    const { data: pack, error: packError } = await supabase
      .from("etl_validation_packs")
      .insert({
        project_id: input.projectId ?? null,
        user_id: input.userId,
        analysis_run_id: input.analysisRunId ?? null,
        pack_name: input.databaseType === "oracle" && definition.packType !== "full_validation_suite"
          ? `${definition.packName} - Oracle`
          : definition.packName,
        pack_type: input.databaseType === "oracle" && definition.packType === "full_validation_suite"
          ? "oracle_validation_pack"
          : definition.packType,
        description: definition.description,
        script_count: matchingScripts.length,
        database_type: input.databaseType,
      })
      .select("*")
      .single();

    if (packError || !pack) throw new Error(packError?.message ?? "Validation pack could not be created.");

    const linkRows = matchingScripts.map((script) => ({
      pack_id: pack.id,
      script_id: script.id,
    }));

    const { error: linkError } = await supabase.from("etl_validation_pack_scripts").insert(linkRows);
    if (linkError) throw new Error(linkError.message);

    createdPacks.push(pack as ValidationPack);
  }

  return createdPacks;
}

export async function getValidationScript(id: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.from("etl_validation_scripts").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return normalizeScriptConfidence(data as ValidationScript);
}

export async function deleteValidationScript(id: string) {
  const supabase = getSupabaseOrThrow();
  const { error } = await supabase.from("etl_validation_scripts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function exportValidationScripts(request: ExportRequest, userId: string) {
  if (!exportTypes.includes(request.exportType)) {
    throw new Error("Unsupported export type.");
  }

  const supabase = getSupabaseOrThrow();
  const scripts = await resolveExportScripts(request);

  if (scripts.length === 0) {
    throw new Error("No scripts are available for export.");
  }

  const createdAt = new Date();
  const stamp = createdAt.toISOString().slice(0, 10);
  const databaseType = scripts[0]?.database_type ?? "oracle";
  const baseName = `etl-qaplanet-validation-${stamp}`;
  const exportFile = await buildExportFile(scripts, request.exportType, baseName, databaseType);

  const { data, error } = await supabase
    .from("etl_script_exports")
    .insert({
      project_id: request.projectId ?? null,
      user_id: userId,
      pack_id: request.packId ?? null,
      export_type: request.exportType,
      file_name: exportFile.fileName,
      file_content: exportFile.fileContent,
      storage_path: null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return {
    export: data as ScriptExport,
    fileName: exportFile.fileName,
    fileContent: exportFile.fileContent,
    contentType: exportFile.contentType,
    encoding: exportFile.encoding,
  };
}

async function resolveExportScripts(request: ExportRequest) {
  const supabase = getSupabaseOrThrow();

  if (request.scriptIds && request.scriptIds.length > 0) {
    const { data, error } = await supabase
      .from("etl_validation_scripts")
      .select("*")
      .in("id", request.scriptIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ValidationScript[]).map(normalizeScriptConfidence);
  }

  if (request.packId) {
    const { data: links, error: linkError } = await supabase
      .from("etl_validation_pack_scripts")
      .select("script_id")
      .eq("pack_id", request.packId);
    if (linkError) throw new Error(linkError.message);
    const ids = (links ?? []).map((link) => link.script_id).filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("etl_validation_scripts").select("*").in("id", ids);
    if (error) throw new Error(error.message);
    return ((data ?? []) as ValidationScript[]).map(normalizeScriptConfidence);
  }

  return (await getSqlSnapshot({ projectId: request.projectId })).scripts;
}

async function buildExportFile(scripts: ValidationScript[], exportType: ExportType, baseName: string, databaseType: string) {
  if (exportType === "csv_inventory" || exportType === "excel_inventory") {
    return {
      fileName: `${baseName}-inventory.csv`,
      fileContent: buildInventoryCsv(scripts),
      contentType: "text/csv",
      encoding: "text" as const,
    };
  }

  if (exportType === "markdown_report") {
    return {
      fileName: `${baseName}-report.md`,
      fileContent: buildMarkdownReport(scripts, databaseType),
      contentType: "text/markdown",
      encoding: "text" as const,
    };
  }

  if (exportType === "zip_package") {
    const zip = new JSZip();
    zip.file("README.md", buildMarkdownReport(scripts, databaseType));
    zip.file("script-inventory.csv", buildInventoryCsv(scripts));
    scripts.forEach((script) => {
      zip.file(`validation-scripts/${categoryFolder(script.validation_category)}/${safeFileName(script.script_name)}.sql`, script.sql_text);
    });

    return {
      fileName: `${baseName}.zip`,
      fileContent: await zip.generateAsync({ type: "base64" }),
      contentType: "application/zip",
      encoding: "base64" as const,
    };
  }

  return {
    fileName: exportType === "oracle_sql_file" ? `${baseName}-oracle.sql` : `${baseName}.sql`,
    fileContent: scripts.map((script) => script.sql_text).join("\n\n"),
    contentType: "application/sql",
    encoding: "text" as const,
  };
}

function buildSqlCounts(scripts: ValidationScript[], packs: ValidationPack[]): SqlCounts {
  return {
    scripts: scripts.length,
    packs: packs.length,
    oracleStatements: scripts.filter((script) => script.database_type === "oracle").length,
    reconciliationScripts: scripts.filter((script) => ["row_count", "sum_reconciliation", "amount_reconciliation"].includes(script.validation_category)).length,
    dataQualityScripts: scripts.filter((script) => script.script_type === "data_quality").length,
    readyScripts: scripts.filter((script) => script.execution_status === "ready" || script.execution_status === "not_run").length,
    needsMappingReview: scripts.filter((script) => (script.confidence_score ?? 100) < 70).length,
    manualReview: scripts.filter((script) => (script.confidence_score ?? 100) < 50 || script.execution_status === "failed_validation").length,
  };
}

async function removeRegeneratedScriptDuplicates(input: {
  analysisRunId: string | null;
  databaseType: DatabaseType;
  generatedFrom: string[];
  categories: ValidationCategory[];
}) {
  if (input.generatedFrom.length === 0) return;
  const supabase = getSupabaseOrThrow();
  let query = supabase
    .from("etl_validation_scripts")
    .delete()
    .eq("database_type", input.databaseType)
    .in("generated_from", [...new Set(input.generatedFrom)])
    .in("validation_category", [...new Set(input.categories)]);

  query = input.analysisRunId ? query.eq("analysis_run_id", input.analysisRunId) : query.is("analysis_run_id", null);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function removeValidationPacksForScope(input: {
  analysisRunId: string | null;
  databaseType: DatabaseType;
}) {
  const supabase = getSupabaseOrThrow();
  let query = supabase
    .from("etl_validation_packs")
    .delete()
    .eq("database_type", input.databaseType);

  query = input.analysisRunId ? query.eq("analysis_run_id", input.analysisRunId) : query.is("analysis_run_id", null);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

function normalizeScriptConfidence(script: ValidationScript): ValidationScript {
  const score = typeof script.confidence_score === "number" ? script.confidence_score : null;
  if (score && score > 0) return script;

  const hasConcreteTable = Boolean(script.source_table || script.target_table);
  const hasConcreteColumn = Boolean(script.source_column || script.target_column);
  const hasTodo = /TODO_|SOURCE_TABLE|TARGET_TABLE|SOURCE_COLUMN|TARGET_COLUMN/i.test(script.sql_text);

  if (hasConcreteTable && hasConcreteColumn && !hasTodo) {
    return { ...script, confidence_score: 75 };
  }

  if (hasConcreteTable && !hasTodo) {
    return { ...script, confidence_score: 65 };
  }

  return { ...script, confidence_score: 40 };
}

function buildInventoryCsv(scripts: ValidationScript[]) {
  const rows = [
    ["Script Name", "Category", "Database", "Source Table", "Target Table", "Confidence", "Status"],
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

function buildMarkdownReport(scripts: ValidationScript[], databaseType: string) {
  return `# ETL QAplanet Validation Package

Generated: ${new Date().toLocaleString("en")}
Database Type: ${databaseType}

## How to Run

1. Review table and schema names before execution.
2. Validate bind variables such as :LOAD_DATE or {{LOAD_DATE}}.
3. Run scripts in a non-production validation environment first.
4. Confirm all exception counts or count differences match the expected result comments.

## Script Inventory

${scripts.map((script, index) => `${index + 1}. ${script.script_name} - ${script.validation_category} - ${script.execution_status}`).join("\n")}

## Review Note

These scripts are generated from extracted ETL analysis and should be reviewed by an ETL QA lead before production execution.
`;
}

function categoryFolder(category: ValidationCategory) {
  if (category === "row_count") return "row-count";
  if (category === "duplicate_check") return "duplicate-checks";
  if (category === "null_check") return "null-checks";
  if (category.includes("transformation") || category.includes("join") || category.includes("filter")) return "transformation-checks";
  return "other-checks";
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "validation-script";
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
