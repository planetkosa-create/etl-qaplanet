import type { DataQualityItem, MappingItem, RuleItem } from "@/lib/etl/analysis";

export const scriptTypes = [
  "sql",
  "oracle_sql",
  "plsql",
  "reconciliation",
  "data_quality",
  "transformation_check",
  "audit_check",
] as const;

export const databaseTypes = ["generic_sql", "oracle", "sql_server", "postgres", "snowflake", "bigquery"] as const;

export const validationCategories = [
  "row_count",
  "sum_reconciliation",
  "amount_reconciliation",
  "duplicate_check",
  "null_check",
  "primary_key_integrity",
  "foreign_key_integrity",
  "transformation_output",
  "aggregation_check",
  "join_validation",
  "filter_validation",
  "domain_value_check",
  "date_validation",
  "audit_balance",
  "custom",
] as const;

export const executionStatuses = ["not_run", "ready", "failed_validation", "executed", "passed", "failed"] as const;

export const packTypes = [
  "row_count_reconciliation",
  "sum_amount_validation",
  "duplicate_detection",
  "primary_key_integrity",
  "null_handling_validation",
  "transformation_logic_checks",
  "oracle_validation_pack",
  "full_validation_suite",
] as const;

export const exportTypes = [
  "sql_file",
  "oracle_sql_file",
  "zip_package",
  "markdown_report",
  "csv_inventory",
  "excel_inventory",
] as const;

export type ScriptType = (typeof scriptTypes)[number];
export type DatabaseType = (typeof databaseTypes)[number];
export type ValidationCategory = (typeof validationCategories)[number];
export type ExecutionStatus = (typeof executionStatuses)[number];
export type PackType = (typeof packTypes)[number];
export type ExportType = (typeof exportTypes)[number];

export type GeneratedValidationScript = {
  script_name: string;
  script_type: ScriptType;
  database_type: DatabaseType;
  validation_category: ValidationCategory;
  source_table: string | null;
  target_table: string | null;
  source_column: string | null;
  target_column: string | null;
  sql_text: string;
  description: string;
  generated_from: string;
  confidence_score: number | null;
  execution_status: ExecutionStatus;
};

export type GenerateScriptsInput = {
  mappings: MappingItem[];
  rules: RuleItem[];
  dataQualityChecks: DataQualityItem[];
  databaseType: string;
  categories?: string[];
};

const restrictedStatementPattern = /\b(drop|delete|update|insert|truncate|alter|merge|grant|revoke|execute\s+immediate)\b/i;

export function normalizeDatabaseType(databaseType?: string | null): DatabaseType {
  const normalized = (databaseType ?? "oracle").toLowerCase().replace(/[\s-]+/g, "_");
  if (databaseTypes.includes(normalized as DatabaseType)) return normalized as DatabaseType;
  return "oracle";
}

export function generateOracleSafeIdentifier(name?: string | null) {
  if (!name) return "TODO_TABLE";
  return name.replace(/[^a-zA-Z0-9_$#.]/g, "_").toUpperCase();
}

export function formatSql(sql: string) {
  return sql
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

export function validateSqlSafety(sql: string) {
  const withoutComments = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  return !restrictedStatementPattern.test(withoutComments);
}

export function generateValidationScriptsFromAnalysis(input: GenerateScriptsInput) {
  const databaseType = normalizeDatabaseType(input.databaseType);
  const categoryFilter = new Set(input.categories?.filter((item) => item !== "all") ?? []);
  const scripts: GeneratedValidationScript[] = [];

  const include = (category: ValidationCategory) => categoryFilter.size === 0 || categoryFilter.has(category);
  const pushSafe = (script: GeneratedValidationScript | null) => {
    if (!script) return;
    const isSafe = validateSqlSafety(script.sql_text);
    scripts.push({
      ...script,
      execution_status: isSafe ? "ready" : "failed_validation",
    });
  };

  input.rules.forEach((rule) => {
    if (rule.rule_type === "reconciliation") {
      if (include("row_count")) pushSafe(generateRowCountScript(rule, databaseType));
      if (include("sum_reconciliation")) pushSafe(generateSumReconciliationScript(rule, databaseType));
    }
    if (rule.rule_type === "aggregation" && include("aggregation_check")) {
      pushSafe(generateSumReconciliationScript(rule, databaseType));
    }
    if (rule.rule_type === "transformation" && include("transformation_output")) {
      pushSafe(generateTransformationOutputScript(rule, databaseType));
    }
    if (rule.rule_type === "join" && include("join_validation")) {
      pushSafe(generateJoinValidationScript(rule, databaseType));
    }
    if (rule.rule_type === "filter" && include("filter_validation")) {
      pushSafe(generateFilterValidationScript(rule, databaseType));
    }
  });

  input.dataQualityChecks.forEach((check) => {
    if (check.check_type === "duplicate_check" && include("duplicate_check")) {
      pushSafe(generateDuplicateCheckScript(check, databaseType));
    }
    if (check.check_type === "null_check" && include("null_check")) {
      pushSafe(generateNullCheckScript(check, databaseType));
    }
    if (check.check_type === "primary_key_integrity" && include("primary_key_integrity")) {
      pushSafe(generatePrimaryKeyIntegrityScript(check, databaseType));
    }
    if ((check.check_type === "sum_reconciliation" || check.check_type === "amount_reconciliation") && include("sum_reconciliation")) {
      pushSafe(generateDataQualityReconciliationScript(check, databaseType));
    }
    if ((check.check_type === "domain_value_check" || check.check_type === "range_check") && include("domain_value_check")) {
      pushSafe(generateGenericDataQualityScript(check, databaseType));
    }
  });

  input.mappings.forEach((mapping) => {
    if (mapping.mapping_type === "direct" && include("transformation_output")) {
      pushSafe(generateDirectMappingComparisonScript(mapping, databaseType));
    }
    if ((mapping.mapping_type === "transformed" || mapping.mapping_type === "derived") && include("transformation_output")) {
      pushSafe(generateTransformationOutputScript(mapping, databaseType));
    }
    if (mapping.mapping_type === "joined" && include("join_validation")) {
      pushSafe(generateJoinValidationScript(mapping, databaseType));
    }
    if (mapping.is_key && include("primary_key_integrity")) {
      pushSafe(generateMappingKeyIntegrityScript(mapping, databaseType));
    }
  });

  return dedupeScripts(scripts);
}

export function generateRowCountScript(item: RuleItem | MappingItem, databaseType: DatabaseType) {
  const sourceTable = getSourceTable(item);
  const targetTable = getTargetTable(item);
  if (!sourceTable && !targetTable) return null;

  const source = ident(sourceTable, databaseType);
  const target = ident(targetTable, databaseType);
  const sourceLabel = sourceTable ?? "SOURCE_TABLE";
  const targetLabel = targetTable ?? "TARGET_TABLE";
  const loadDateColumn = "affected_columns" in item ? getFirstColumn(item.affected_columns, "LOAD_DT") : "LOAD_DT";
  const datePredicate = databaseType === "oracle"
    ? `WHERE TRUNC(${ident(loadDateColumn, databaseType)}) = :LOAD_DATE`
    : `WHERE ${ident(loadDateColumn, databaseType)} = {{LOAD_DATE}}`;

  return makeScript({
    scriptName: `Row Count - ${sourceLabel} to ${targetLabel}`,
    scriptType: "reconciliation",
    databaseType,
    category: "row_count",
    sourceTable,
    targetTable,
    confidence: getConfidence(item),
    generatedFrom: getGeneratedFrom(item),
    description: "Compare source and target row counts for the same load date.",
    sql: `
${header("Row Count Reconciliation", "Compare source and target row counts for the same load date.", sourceLabel, targetLabel)}
SELECT
  'ROW_COUNT_CHECK' AS CHECK_NAME,
  '${sourceLabel}' AS SOURCE_TABLE,
  '${targetLabel}' AS TARGET_TABLE,
  SRC.SRC_COUNT,
  TGT.TGT_COUNT,
  TGT.TGT_COUNT - SRC.SRC_COUNT AS COUNT_DIFF
FROM
  (
    SELECT COUNT(*) AS SRC_COUNT
    FROM ${source}
    ${datePredicate}
  ) SRC
CROSS JOIN
  (
    SELECT COUNT(*) AS TGT_COUNT
    FROM ${target}
    ${datePredicate}
  ) TGT;`,
  });
}

export function generateDuplicateCheckScript(check: DataQualityItem, databaseType: DatabaseType) {
  const tableName = check.table_name || "TODO_TARGET_TABLE";
  const columnName = check.column_name || "TODO_KEY_COLUMN";

  return makeScript({
    scriptName: `Duplicate Check - ${tableName}.${columnName}`,
    scriptType: "data_quality",
    databaseType,
    category: "duplicate_check",
    targetTable: tableName,
    targetColumn: columnName,
    confidence: check.confidence_score,
    generatedFrom: `data_quality:${check.id}`,
    description: check.description || `Detect duplicate ${columnName} records in ${tableName}.`,
    sql: `
${header("Duplicate Detection", `Detect duplicate ${columnName} records in target table.`, null, tableName)}
SELECT
  ${ident(columnName, databaseType)},
  COUNT(*) AS DUPLICATE_COUNT
FROM ${ident(tableName, databaseType)}
GROUP BY ${ident(columnName, databaseType)}
HAVING COUNT(*) > 1;`,
  });
}

export function generateNullCheckScript(check: DataQualityItem, databaseType: DatabaseType) {
  const tableName = check.table_name || "TODO_TARGET_TABLE";
  const columnName = check.column_name || "TODO_REQUIRED_COLUMN";

  return makeScript({
    scriptName: `Null Check - ${tableName}.${columnName}`,
    scriptType: "data_quality",
    databaseType,
    category: "null_check",
    targetTable: tableName,
    targetColumn: columnName,
    confidence: check.confidence_score,
    generatedFrom: `data_quality:${check.id}`,
    description: check.description || `Verify required column ${columnName} is not null.`,
    sql: `
${header("Required Field Null Check", `Verify required column ${columnName} is not null.`, null, tableName)}
SELECT
  '${columnName}_NULL_CHECK' AS CHECK_NAME,
  COUNT(*) AS NULL_COUNT
FROM ${ident(tableName, databaseType)}
WHERE ${ident(columnName, databaseType)} IS NULL;`,
  });
}

export function generatePrimaryKeyIntegrityScript(check: DataQualityItem, databaseType: DatabaseType) {
  const tableName = check.table_name || "TODO_TARGET_TABLE";
  const columnName = check.column_name || "TODO_PRIMARY_KEY";

  return makeScript({
    scriptName: `Primary Key Integrity - ${tableName}.${columnName}`,
    scriptType: "data_quality",
    databaseType,
    category: "primary_key_integrity",
    targetTable: tableName,
    targetColumn: columnName,
    confidence: check.confidence_score,
    generatedFrom: `data_quality:${check.id}`,
    description: check.description || `Validate primary key uniqueness and null safety for ${columnName}.`,
    sql: `
${header("Primary Key Integrity", `Validate ${columnName} is populated and unique.`, null, tableName)}
SELECT
  '${columnName}_PK_INTEGRITY' AS CHECK_NAME,
  COUNT(*) AS TOTAL_ROWS,
  SUM(CASE WHEN ${ident(columnName, databaseType)} IS NULL THEN 1 ELSE 0 END) AS NULL_KEY_COUNT,
  COUNT(DISTINCT ${ident(columnName, databaseType)}) AS DISTINCT_KEY_COUNT,
  COUNT(*) - COUNT(DISTINCT ${ident(columnName, databaseType)}) AS DUPLICATE_KEY_COUNT
FROM ${ident(tableName, databaseType)};`,
  });
}

export function generateSumReconciliationScript(rule: RuleItem, databaseType: DatabaseType) {
  const sourceTable = getFirstTable(rule.affected_tables, "SOURCE_TABLE");
  const targetTable = getSecondTable(rule.affected_tables, "TARGET_TABLE");
  const measureColumn = getFirstColumn(rule.affected_columns, "TODO_AMOUNT_COLUMN");
  const nullSafe = databaseType === "oracle" ? "NVL" : "COALESCE";

  return makeScript({
    scriptName: `Sum Reconciliation - ${measureColumn}`,
    scriptType: "reconciliation",
    databaseType,
    category: "sum_reconciliation",
    sourceTable,
    targetTable,
    sourceColumn: measureColumn,
    targetColumn: measureColumn,
    confidence: rule.confidence_score,
    generatedFrom: `rule:${rule.id}`,
    description: rule.description || `Compare source and target totals for ${measureColumn}.`,
    sql: `
${header("Sum / Amount Reconciliation", `Compare source and target totals for ${measureColumn}.`, sourceTable, targetTable)}
SELECT
  'SUM_RECONCILIATION' AS CHECK_NAME,
  SRC.SRC_TOTAL,
  TGT.TGT_TOTAL,
  TGT.TGT_TOTAL - SRC.SRC_TOTAL AS TOTAL_DIFF
FROM
  (
    SELECT ${nullSafe}(SUM(${ident(measureColumn, databaseType)}), 0) AS SRC_TOTAL
    FROM ${ident(sourceTable, databaseType)}
  ) SRC
CROSS JOIN
  (
    SELECT ${nullSafe}(SUM(${ident(measureColumn, databaseType)}), 0) AS TGT_TOTAL
    FROM ${ident(targetTable, databaseType)}
  ) TGT;`,
  });
}

export function generateTransformationOutputScript(item: RuleItem | MappingItem, databaseType: DatabaseType) {
  const sourceTable = getSourceTable(item);
  const targetTable = getTargetTable(item);
  const sourceColumn = getSourceColumn(item);
  const targetColumn = getTargetColumn(item);
  const comparator = databaseType === "oracle" ? "NVL" : "COALESCE";

  return makeScript({
    scriptName: `Transformation Output - ${targetColumn || targetTable || "Target"}`,
    scriptType: "transformation_check",
    databaseType,
    category: "transformation_output",
    sourceTable,
    targetTable,
    sourceColumn,
    targetColumn,
    confidence: getConfidence(item),
    generatedFrom: getGeneratedFrom(item),
    description: getDescription(item) || "Validate transformed source output against target values.",
    sql: `
${header("Transformation Output Validation", "Compare transformed source output against target values.", sourceTable, targetTable)}
SELECT
  'TRANSFORMATION_OUTPUT_CHECK' AS CHECK_NAME,
  COUNT(*) AS MISMATCH_COUNT
FROM ${ident(targetTable, databaseType)} TGT
WHERE NOT EXISTS (
  SELECT 1
  FROM ${ident(sourceTable, databaseType)} SRC
  WHERE ${comparator}(TO_CHAR(SRC.${ident(sourceColumn, databaseType)}), '__NULL__') =
        ${comparator}(TO_CHAR(TGT.${ident(targetColumn, databaseType)}), '__NULL__')
);`,
  });
}

export function generateJoinValidationScript(item: RuleItem | MappingItem, databaseType: DatabaseType) {
  const sourceTable = getSourceTable(item);
  const targetTable = getTargetTable(item);
  const joinCondition = "join_condition" in item ? item.join_condition : item.source_expression;

  return makeScript({
    scriptName: `Join Validation - ${targetTable || sourceTable || "ETL"}`,
    scriptType: "transformation_check",
    databaseType,
    category: "join_validation",
    sourceTable,
    targetTable,
    confidence: getConfidence(item),
    generatedFrom: getGeneratedFrom(item),
    description: getDescription(item) || "Validate join logic does not create unexpected unmatched records.",
    sql: `
${header("Join Validation", "Find source rows that do not satisfy the expected join relationship.", sourceTable, targetTable)}
SELECT
  'JOIN_VALIDATION' AS CHECK_NAME,
  COUNT(*) AS UNMATCHED_COUNT
FROM ${ident(sourceTable, databaseType)} SRC
LEFT JOIN ${ident(targetTable, databaseType)} TGT
  ON ${joinCondition || "/* TODO: confirm join condition */ SRC.TODO_KEY = TGT.TODO_KEY"}
WHERE TGT.TODO_KEY IS NULL;`,
  });
}

export function generateFilterValidationScript(rule: RuleItem, databaseType: DatabaseType) {
  const sourceTable = getFirstTable(rule.affected_tables, "SOURCE_TABLE");
  const filter = rule.source_expression || "/* TODO: confirm filter condition */ 1 = 1";

  return makeScript({
    scriptName: `Filter Validation - ${sourceTable}`,
    scriptType: "transformation_check",
    databaseType,
    category: "filter_validation",
    sourceTable,
    confidence: rule.confidence_score,
    generatedFrom: `rule:${rule.id}`,
    description: rule.description || "Validate source filter logic and excluded records.",
    sql: `
${header("Filter Validation", "Count records included by the extracted ETL filter condition.", sourceTable, null)}
SELECT
  'FILTER_VALIDATION' AS CHECK_NAME,
  COUNT(*) AS INCLUDED_ROW_COUNT
FROM ${ident(sourceTable, databaseType)}
WHERE ${filter};`,
  });
}

function generateDirectMappingComparisonScript(mapping: MappingItem, databaseType: DatabaseType) {
  const sourceTable = mapping.source_table || "SOURCE_TABLE";
  const targetTable = mapping.target_table || "TARGET_TABLE";
  const sourceColumn = mapping.source_column || "SOURCE_COLUMN";
  const targetColumn = mapping.target_column || "TARGET_COLUMN";
  const setDiff = databaseType === "oracle" ? "MINUS" : "EXCEPT";
  const nullSafe = databaseType === "oracle" ? "NVL" : "COALESCE";

  return makeScript({
    scriptName: `Direct Mapping - ${sourceColumn} to ${targetColumn}`,
    scriptType: databaseType === "oracle" ? "oracle_sql" : "sql",
    databaseType,
    category: "transformation_output",
    sourceTable,
    targetTable,
    sourceColumn,
    targetColumn,
    confidence: mapping.confidence_score,
    generatedFrom: `mapping:${mapping.id}`,
    description: mapping.business_rule || "Validate direct source-to-target value preservation.",
    sql: `
${header("Direct Mapping Value Comparison", `Validate ${sourceColumn} is preserved as ${targetColumn}.`, sourceTable, targetTable)}
SELECT '${sourceColumn}_TO_${targetColumn}_SOURCE_MINUS_TARGET' AS CHECK_NAME, COUNT(*) AS DIFFERENCE_COUNT
FROM (
  SELECT ${nullSafe}(TO_CHAR(${ident(sourceColumn, databaseType)}), '__NULL__') AS VALUE_TO_COMPARE
  FROM ${ident(sourceTable, databaseType)}
  ${setDiff}
  SELECT ${nullSafe}(TO_CHAR(${ident(targetColumn, databaseType)}), '__NULL__') AS VALUE_TO_COMPARE
  FROM ${ident(targetTable, databaseType)}
) DIFFS;`,
  });
}

function generateMappingKeyIntegrityScript(mapping: MappingItem, databaseType: DatabaseType) {
  const check: DataQualityItem = {
    id: mapping.id,
    analysis_run_id: mapping.analysis_run_id,
    artifact_id: mapping.artifact_id,
    check_type: "primary_key_integrity",
    table_name: mapping.target_table,
    column_name: mapping.target_column,
    description: mapping.business_rule,
    expected_condition: "Key field is populated and unique",
    suggested_validation: null,
    severity: "high",
    confidence_score: mapping.confidence_score,
    created_at: mapping.created_at,
  };

  return generatePrimaryKeyIntegrityScript(check, databaseType);
}

function generateDataQualityReconciliationScript(check: DataQualityItem, databaseType: DatabaseType) {
  const pseudoRule: RuleItem = {
    id: check.id,
    analysis_run_id: check.analysis_run_id,
    artifact_id: check.artifact_id,
    rule_reference: null,
    rule_type: "reconciliation",
    title: check.description,
    description: check.description,
    source_expression: null,
    target_expression: null,
    validation_intent: check.expected_condition,
    affected_tables: check.table_name ? [check.table_name] : null,
    affected_columns: check.column_name ? [check.column_name] : null,
    severity: check.severity,
    confidence_score: check.confidence_score,
    created_at: check.created_at,
  };

  return generateSumReconciliationScript(pseudoRule, databaseType);
}

function generateGenericDataQualityScript(check: DataQualityItem, databaseType: DatabaseType) {
  const tableName = check.table_name || "TODO_TARGET_TABLE";
  const condition = check.expected_condition || check.suggested_validation || "/* TODO: confirm expected condition */ 1 = 1";

  return makeScript({
    scriptName: `Data Quality - ${tableName}`,
    scriptType: "data_quality",
    databaseType,
    category: "domain_value_check",
    targetTable: tableName,
    targetColumn: check.column_name,
    confidence: check.confidence_score,
    generatedFrom: `data_quality:${check.id}`,
    description: check.description || "Validate data quality business condition.",
    sql: `
${header("Data Quality Condition", check.description || "Validate data quality business condition.", null, tableName)}
SELECT
  'DATA_QUALITY_CONDITION' AS CHECK_NAME,
  COUNT(*) AS EXCEPTION_COUNT
FROM ${ident(tableName, databaseType)}
WHERE NOT (${condition});`,
  });
}

function makeScript(input: {
  scriptName: string;
  scriptType: ScriptType;
  databaseType: DatabaseType;
  category: ValidationCategory;
  sourceTable?: string | null;
  targetTable?: string | null;
  sourceColumn?: string | null;
  targetColumn?: string | null;
  confidence?: number | null;
  generatedFrom: string;
  description: string;
  sql: string;
}): GeneratedValidationScript {
  const sqlText = formatSql(input.sql);
  const confidence = resolveConfidence(input.confidence, {
    sourceTable: input.sourceTable,
    targetTable: input.targetTable,
    sourceColumn: input.sourceColumn,
    targetColumn: input.targetColumn,
    sql: sqlText,
  });
  return {
    script_name: sanitizeScriptName(input.scriptName),
    script_type: input.scriptType,
    database_type: input.databaseType,
    validation_category: input.category,
    source_table: input.sourceTable ?? null,
    target_table: input.targetTable ?? null,
    source_column: input.sourceColumn ?? null,
    target_column: input.targetColumn ?? null,
    sql_text: sqlText,
    description: input.description,
    generated_from: input.generatedFrom,
    confidence_score: confidence.score,
    execution_status: "ready",
  };
}

function header(validation: string, purpose: string, sourceTable?: string | null, targetTable?: string | null) {
  return [
    `-- Validation: ${validation}`,
    `-- Purpose: ${purpose}`,
    sourceTable ? `-- Source: ${sourceTable}` : null,
    targetTable ? `-- Target: ${targetTable}` : null,
    "-- Expected Result: Query should return zero exceptions or a zero difference.",
    "-- Safety: Review table/schema names before execution.",
    "-- Safety: Validate bind variables before execution.",
    "-- Safety: Do not run against production without approval.",
  ].filter(Boolean).join("\n");
}

function ident(value: string | null | undefined, databaseType: DatabaseType) {
  const safe = generateOracleSafeIdentifier(value);
  if (databaseType === "postgres") return safe.toLowerCase();
  return safe;
}

function getSourceTable(item: RuleItem | MappingItem) {
  if ("source_table" in item) return item.source_table || null;
  return getFirstTable(item.affected_tables, "SOURCE_TABLE");
}

function getTargetTable(item: RuleItem | MappingItem) {
  if ("target_table" in item) return item.target_table || null;
  return getSecondTable(item.affected_tables, "TARGET_TABLE");
}

function getSourceColumn(item: RuleItem | MappingItem) {
  if ("source_column" in item) return item.source_column || null;
  return getFirstColumn(item.affected_columns, "SOURCE_COLUMN");
}

function getTargetColumn(item: RuleItem | MappingItem) {
  if ("target_column" in item) return item.target_column || null;
  return getSecondColumn(item.affected_columns, "TARGET_COLUMN");
}

function getConfidence(item: RuleItem | MappingItem) {
  return item.confidence_score ?? null;
}

function getDescription(item: RuleItem | MappingItem) {
  if ("business_rule" in item) return item.business_rule || item.transformation_rule || null;
  return item.description || item.validation_intent || null;
}

function getGeneratedFrom(item: RuleItem | MappingItem) {
  if ("mapping_type" in item) return `mapping:${item.id}`;
  return `rule:${item.id}`;
}

function getFirstTable(tables?: string[] | null, fallback = "SOURCE_TABLE") {
  return tables?.[0] || fallback;
}

function getSecondTable(tables?: string[] | null, fallback = "TARGET_TABLE") {
  return tables?.[1] || tables?.[0] || fallback;
}

function getFirstColumn(columns?: string[] | null, fallback = "SOURCE_COLUMN") {
  return columns?.[0] || fallback;
}

function getSecondColumn(columns?: string[] | null, fallback = "TARGET_COLUMN") {
  return columns?.[1] || columns?.[0] || fallback;
}

function clampConfidence(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveConfidence(value: number | null | undefined, context: {
  sourceTable?: string | null;
  targetTable?: string | null;
  sourceColumn?: string | null;
  targetColumn?: string | null;
  sql: string;
}) {
  const score = clampConfidence(value);
  if (score && score > 0) {
    return { score, source: "source" as const };
  }

  const hasConcreteTable = Boolean(context.sourceTable || context.targetTable);
  const hasConcreteColumn = Boolean(context.sourceColumn || context.targetColumn);
  const hasTodo = hasUnresolvedPlaceholder(context.sql);

  if (hasConcreteTable && hasConcreteColumn && !hasTodo) {
    return { score: 75, source: "inferred" as const };
  }

  if (hasConcreteTable && !hasTodo) {
    return { score: 65, source: "inferred" as const };
  }

  return { score: 40, source: "review" as const };
}

function hasUnresolvedPlaceholder(sql: string) {
  return /TODO_|\bSOURCE_COLUMN\b|\bTARGET_COLUMN\b|\bFROM\s+SOURCE_TABLE\b|\bFROM\s+TARGET_TABLE\b|\bJOIN\s+SOURCE_TABLE\b|\bJOIN\s+TARGET_TABLE\b/i.test(sql);
}

function sanitizeScriptName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 140);
}

function dedupeScripts(scripts: GeneratedValidationScript[]) {
  const seen = new Set<string>();
  return scripts.filter((script) => {
    const key = [
      script.script_name,
      script.validation_category,
      script.source_table,
      script.target_table,
      script.source_column,
      script.target_column,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
