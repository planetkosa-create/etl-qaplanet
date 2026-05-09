import { getSupabaseOrThrow, type EtlArtifact, type JsonValue } from "@/lib/etl/artifacts";
import {
  mappingTypes,
  normalizeDataQualityConfidence,
  normalizeMappingConfidence,
  normalizeRuleConfidence,
  ruleTypes,
  severities,
  type DataQualityItem,
  type MappingItem,
  type MappingType,
  type RuleItem,
  type RuleType,
  type Severity,
} from "@/lib/etl/analysis";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_ARTIFACT_TEXT = 12000;
const MAX_JSON_SUMMARY = 5000;

export type NormalizedEtlAnalysis = {
  summary: {
    description: string;
    source_systems: string[];
    target_systems: string[];
    tables_detected: string[];
    overall_confidence: number;
  };
  mappings: Array<{
    source_system: string;
    source_table: string;
    source_column: string;
    target_system: string;
    target_table: string;
    target_column: string;
    data_type: string;
    transformation_rule: string;
    business_rule: string;
    mapping_type: MappingType;
    join_condition: string;
    filter_condition: string;
    is_required: boolean;
    is_key: boolean;
    confidence_score: number;
  }>;
  rules: Array<{
    rule_reference: string;
    rule_type: RuleType;
    title: string;
    description: string;
    source_expression: string;
    target_expression: string;
    validation_intent: string;
    affected_tables: string[];
    affected_columns: string[];
    severity: Severity;
    confidence_score: number;
  }>;
  data_quality_checks: Array<{
    check_type: string;
    table_name: string;
    column_name: string;
    description: string;
    expected_condition: string;
    suggested_validation: string;
    severity: Severity;
    confidence_score: number;
  }>;
  gaps: Array<{
    gap_type: string;
    title: string;
    description: string;
    impact: string;
    recommendation: string;
    severity: Severity;
  }>;
};

export async function runEtlAnalysisForArtifacts(artifacts: EtlArtifact[]) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI analysis is not configured. Please set OPENAI_API_KEY.");
  }

  if (artifacts.length === 0) {
    throw new Error("No processed ETL artifacts are available for analysis.");
  }

  const prompt = buildEtlAnalysisPrompt(artifacts);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions:
        "You are a senior ETL QA architect. Return JSON only. Do not generate SQL in Phase 3. Extract structured ETL analysis that will later be used for validation SQL generation.",
      input: prompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await safeReadError(response);
    throw new Error(body || "OpenAI analysis request failed.");
  }

  const payload = (await response.json()) as { output_text?: string; output?: unknown };
  const text = extractResponseText(payload);

  if (!text) {
    throw new Error("AI analysis returned an empty response.");
  }

  return normalizeEtlAnalysisResponse(parseJsonPayload(text));
}

export function buildEtlAnalysisPrompt(artifacts: EtlArtifact[]) {
  const artifactBlocks = artifacts.map((artifact, index) => {
    const text = artifact.extracted_text ?? "";
    const jsonSummary = summarizeJson(artifact.extracted_json);

    return [
      `Artifact ${index + 1}`,
      `file_name: ${artifact.file_name}`,
      `source_kind: ${artifact.source_kind}`,
      `file_type: ${artifact.file_type}`,
      "extracted_text:",
      truncate(text, MAX_ARTIFACT_TEXT),
      "extracted_json_summary:",
      truncate(jsonSummary, MAX_JSON_SUMMARY),
    ].join("\n");
  });

  return `
Return one valid JSON object with exactly these top-level keys:
summary, mappings, rules, data_quality_checks, gaps.

Expected shape:
{
  "summary": {
    "description": "string",
    "source_systems": ["string"],
    "target_systems": ["string"],
    "tables_detected": ["string"],
    "overall_confidence": 0
  },
  "mappings": [],
  "rules": [],
  "data_quality_checks": [],
  "gaps": []
}

Extract source-to-target mappings, direct mappings, transformed mappings, derived fields, aggregation logic, join conditions, filter conditions, null-handling rules, default value rules, duplicate rules, key constraints, reconciliation rules, data quality checks, business logic gaps, and ambiguous or missing mapping details.

Do not generate validation SQL. Suggested validation expressions may be concise pseudo-validation only.

Allowed mapping_type values: ${mappingTypes.join(", ")}.
Allowed rule_type values: ${ruleTypes.join(", ")}.
Allowed severity values: ${severities.join(", ")}.
Confidence scores must be integers from 0 to 100.

ETL artifacts:
${artifactBlocks.join("\n\n---\n\n")}
`;
}

export function normalizeEtlAnalysisResponse(payload: unknown): NormalizedEtlAnalysis {
  const value = isRecord(payload) ? payload : {};
  const summary = isRecord(value.summary) ? value.summary : {};

  return {
    summary: {
      description: asString(summary.description),
      source_systems: asStringArray(summary.source_systems),
      target_systems: asStringArray(summary.target_systems),
      tables_detected: asStringArray(summary.tables_detected),
      overall_confidence: clampConfidence(summary.overall_confidence),
    },
    mappings: asArray(value.mappings).map((item, index) => {
      const row = isRecord(item) ? item : {};

      const mapping = {
        id: `normalized-mapping-${index}`,
        analysis_run_id: "normalized",
        artifact_id: null,
        source_system: asString(row.source_system),
        source_table: asString(row.source_table),
        source_column: asString(row.source_column),
        target_system: asString(row.target_system),
        target_table: asString(row.target_table),
        target_column: asString(row.target_column),
        data_type: asString(row.data_type),
        transformation_rule: asString(row.transformation_rule),
        business_rule: asString(row.business_rule),
        mapping_type: normalizeEnum(row.mapping_type, mappingTypes, "unknown"),
        join_condition: asString(row.join_condition),
        filter_condition: asString(row.filter_condition),
        is_required: Boolean(row.is_required),
        is_key: Boolean(row.is_key),
        confidence_score: clampConfidence(row.confidence_score),
        created_at: new Date().toISOString(),
      } satisfies MappingItem;

      const normalized = normalizeMappingConfidence(mapping);
      return {
        source_system: normalized.source_system ?? "",
        source_table: normalized.source_table ?? "",
        source_column: normalized.source_column ?? "",
        target_system: normalized.target_system ?? "",
        target_table: normalized.target_table ?? "",
        target_column: normalized.target_column ?? "",
        data_type: normalized.data_type ?? "",
        transformation_rule: normalized.transformation_rule ?? "",
        business_rule: normalized.business_rule ?? "",
        mapping_type: normalized.mapping_type,
        join_condition: normalized.join_condition ?? "",
        filter_condition: normalized.filter_condition ?? "",
        is_required: normalized.is_required,
        is_key: normalized.is_key,
        confidence_score: normalized.confidence_score ?? 0,
      };
    }),
    rules: asArray(value.rules).map((item, index) => {
      const row = isRecord(item) ? item : {};

      const rule = {
        id: `normalized-rule-${index}`,
        analysis_run_id: "normalized",
        artifact_id: null,
        rule_reference: asString(row.rule_reference) || `RULE-${String(index + 1).padStart(3, "0")}`,
        rule_type: normalizeEnum(row.rule_type, ruleTypes, "other"),
        title: asString(row.title),
        description: asString(row.description),
        source_expression: asString(row.source_expression),
        target_expression: asString(row.target_expression),
        validation_intent: asString(row.validation_intent),
        affected_tables: asStringArray(row.affected_tables),
        affected_columns: asStringArray(row.affected_columns),
        severity: normalizeEnum(row.severity, severities, "medium"),
        confidence_score: clampConfidence(row.confidence_score),
        created_at: new Date().toISOString(),
      } satisfies RuleItem;

      const normalized = normalizeRuleConfidence(rule);
      return {
        rule_reference: normalized.rule_reference ?? "",
        rule_type: normalized.rule_type,
        title: normalized.title ?? "",
        description: normalized.description ?? "",
        source_expression: normalized.source_expression ?? "",
        target_expression: normalized.target_expression ?? "",
        validation_intent: normalized.validation_intent ?? "",
        affected_tables: normalized.affected_tables ?? [],
        affected_columns: normalized.affected_columns ?? [],
        severity: normalized.severity,
        confidence_score: normalized.confidence_score ?? 0,
      };
    }),
    data_quality_checks: asArray(value.data_quality_checks).map((item, index) => {
      const row = isRecord(item) ? item : {};

      const check = {
        id: `normalized-check-${index}`,
        analysis_run_id: "normalized",
        artifact_id: null,
        check_type: asString(row.check_type) || "data_quality",
        table_name: asString(row.table_name),
        column_name: asString(row.column_name),
        description: asString(row.description),
        expected_condition: asString(row.expected_condition),
        suggested_validation: asString(row.suggested_validation),
        severity: normalizeEnum(row.severity, severities, "medium"),
        confidence_score: clampConfidence(row.confidence_score),
        created_at: new Date().toISOString(),
      } satisfies DataQualityItem;

      const normalized = normalizeDataQualityConfidence(check);
      return {
        check_type: normalized.check_type ?? "data_quality",
        table_name: normalized.table_name ?? "",
        column_name: normalized.column_name ?? "",
        description: normalized.description ?? "",
        expected_condition: normalized.expected_condition ?? "",
        suggested_validation: normalized.suggested_validation ?? "",
        severity: normalized.severity,
        confidence_score: normalized.confidence_score ?? 0,
      };
    }),
    gaps: asArray(value.gaps).map((item) => {
      const row = isRecord(item) ? item : {};

      return {
        gap_type: asString(row.gap_type) || "incomplete_mapping",
        title: asString(row.title),
        description: asString(row.description),
        impact: asString(row.impact),
        recommendation: asString(row.recommendation),
        severity: normalizeEnum(row.severity, severities, "medium"),
      };
    }),
  };
}

export async function saveEtlAnalysisResults(
  analysisRunId: string,
  result: NormalizedEtlAnalysis,
  artifactId?: string | null,
  userId?: string | null,
) {
  const supabase = getSupabaseOrThrow();

  const [mappingResult, ruleResult, qualityResult, gapResult] = await Promise.all([
    result.mappings.length
      ? supabase.from("etl_mapping_items").insert(
          result.mappings.map((item) => ({
            analysis_run_id: analysisRunId,
            artifact_id: artifactId ?? null,
            user_id: userId ?? null,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
    result.rules.length
      ? supabase.from("etl_rule_items").insert(
          result.rules.map((item) => ({
            analysis_run_id: analysisRunId,
            artifact_id: artifactId ?? null,
            user_id: userId ?? null,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
    result.data_quality_checks.length
      ? supabase.from("etl_data_quality_items").insert(
          result.data_quality_checks.map((item) => ({
            analysis_run_id: analysisRunId,
            artifact_id: artifactId ?? null,
            user_id: userId ?? null,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
    result.gaps.length
      ? supabase.from("etl_analysis_gaps").insert(
          result.gaps.map((item) => ({
            analysis_run_id: analysisRunId,
            artifact_id: artifactId ?? null,
            user_id: userId ?? null,
            ...item,
          })),
        )
      : Promise.resolve({ error: null }),
  ]);

  const error = mappingResult.error ?? ruleResult.error ?? qualityResult.error ?? gapResult.error;
  if (error) {
    throw new Error(error.message);
  }
}

function extractResponseText(payload: { output_text?: string; output?: unknown }) {
  if (payload.output_text) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];

  return output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .join("\n")
    .trim();
}

function parseJsonPayload(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI analysis returned invalid JSON. Please retry analysis.");
  }
}

async function safeReadError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message;
  } catch {
    return "";
  }
}

function summarizeJson(value: JsonValue | null) {
  if (!value) return "No structured JSON.";
  return JSON.stringify(value).slice(0, MAX_JSON_SUMMARY);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[TRUNCATED ${value.length - maxLength} CHARACTERS]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  return allowed.includes(asString(value) as T[number]) ? (asString(value) as T[number]) : fallback;
}
