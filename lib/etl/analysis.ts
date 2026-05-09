import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const analysisStatuses = ["queued", "running", "completed", "failed"] as const;
export const mappingTypes = ["direct", "transformed", "derived", "aggregated", "joined", "lookup", "constant", "excluded", "unknown"] as const;
export const ruleTypes = [
  "transformation",
  "join",
  "filter",
  "null_handling",
  "aggregation",
  "reconciliation",
  "duplicate_check",
  "primary_key",
  "foreign_key",
  "data_quality",
  "business_constraint",
  "audit",
  "other",
] as const;
export const severities = ["critical", "high", "medium", "low"] as const;

export type AnalysisStatus = (typeof analysisStatuses)[number];
export type MappingType = (typeof mappingTypes)[number];
export type RuleType = (typeof ruleTypes)[number];
export type Severity = (typeof severities)[number];

export type AnalysisRun = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  run_name: string | null;
  status: AnalysisStatus;
  artifact_count: number;
  model_name: string | null;
  input_summary: string | null;
  output_summary: string | null;
  processing_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MappingItem = {
  id: string;
  analysis_run_id: string;
  artifact_id: string | null;
  source_system: string | null;
  source_table: string | null;
  source_column: string | null;
  target_system: string | null;
  target_table: string | null;
  target_column: string | null;
  data_type: string | null;
  transformation_rule: string | null;
  business_rule: string | null;
  mapping_type: MappingType;
  join_condition: string | null;
  filter_condition: string | null;
  is_required: boolean;
  is_key: boolean;
  confidence_score: number | null;
  created_at: string;
};

export type RuleItem = {
  id: string;
  analysis_run_id: string;
  artifact_id: string | null;
  rule_reference: string | null;
  rule_type: RuleType;
  title: string | null;
  description: string | null;
  source_expression: string | null;
  target_expression: string | null;
  validation_intent: string | null;
  affected_tables: string[] | null;
  affected_columns: string[] | null;
  severity: Severity;
  confidence_score: number | null;
  created_at: string;
};

export type DataQualityItem = {
  id: string;
  analysis_run_id: string;
  artifact_id: string | null;
  check_type: string | null;
  table_name: string | null;
  column_name: string | null;
  description: string | null;
  expected_condition: string | null;
  suggested_validation: string | null;
  severity: Severity;
  confidence_score: number | null;
  created_at: string;
};

export type AnalysisGap = {
  id: string;
  analysis_run_id: string;
  artifact_id: string | null;
  gap_type: string | null;
  title: string | null;
  description: string | null;
  impact: string | null;
  recommendation: string | null;
  severity: Severity;
  created_at: string;
};

export type AnalysisCounts = {
  mappings: number;
  rules: number;
  dataQualityChecks: number;
  gaps: number;
  reconciliationRules: number;
};

export type AnalysisSnapshot = {
  configured: boolean;
  latestRun: AnalysisRun | null;
  runs: AnalysisRun[];
  mappings: MappingItem[];
  rules: RuleItem[];
  dataQualityChecks: DataQualityItem[];
  gaps: AnalysisGap[];
  counts: AnalysisCounts;
  error?: string;
};

export function emptyCounts(): AnalysisCounts {
  return {
    mappings: 0,
    rules: 0,
    dataQualityChecks: 0,
    gaps: 0,
    reconciliationRules: 0,
  };
}

export async function getAnalysisSnapshot(): Promise<AnalysisSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      latestRun: null,
      runs: [],
      mappings: [],
      rules: [],
      dataQualityChecks: [],
      gaps: [],
      counts: emptyCounts(),
      error: "Supabase is not configured.",
    };
  }

  try {
    const supabase = getSupabaseOrThrow();
    const { data: runs, error: runsError } = await supabase
      .from("etl_analysis_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (runsError) {
      throw new Error(runsError.message);
    }

    const latestRun = ((runs ?? [])[0] ?? null) as AnalysisRun | null;
    const [mappings, rules, checks, gaps] = await Promise.all([
      supabase.from("etl_mapping_items").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("etl_rule_items").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("etl_data_quality_items").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("etl_analysis_gaps").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    const firstError = mappings.error ?? rules.error ?? checks.error ?? gaps.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    const mappingItems = ((mappings.data ?? []) as MappingItem[]).map(normalizeMappingConfidence);
    const ruleItems = ((rules.data ?? []) as RuleItem[]).map(normalizeRuleConfidence);
    const qualityItems = ((checks.data ?? []) as DataQualityItem[]).map(normalizeDataQualityConfidence);

    return {
      configured: true,
      latestRun,
      runs: (runs ?? []) as AnalysisRun[],
      mappings: mappingItems,
      rules: ruleItems,
      dataQualityChecks: qualityItems,
      gaps: (gaps.data ?? []) as AnalysisGap[],
      counts: {
        mappings: mappingItems.length,
        rules: ruleItems.length,
        dataQualityChecks: qualityItems.length,
        gaps: gaps.data?.length ?? 0,
        reconciliationRules: ruleItems.filter((rule) => rule.rule_type === "reconciliation").length,
      },
    };
  } catch (error) {
    return {
      configured: true,
      latestRun: null,
      runs: [],
      mappings: [],
      rules: [],
      dataQualityChecks: [],
      gaps: [],
      counts: emptyCounts(),
      error: error instanceof Error ? error.message : "Analysis data could not be loaded.",
    };
  }
}

export async function getAnalysisRunSnapshot(id: string) {
  const snapshot = await getAnalysisSnapshot();

  return {
    ...snapshot,
    latestRun: snapshot.runs.find((run) => run.id === id) ?? snapshot.latestRun,
    mappings: snapshot.mappings.filter((item) => item.analysis_run_id === id),
    rules: snapshot.rules.filter((item) => item.analysis_run_id === id),
    dataQualityChecks: snapshot.dataQualityChecks.filter((item) => item.analysis_run_id === id),
    gaps: snapshot.gaps.filter((item) => item.analysis_run_id === id),
  };
}

export async function resetAnalysisData() {
  const supabase = getSupabaseOrThrow();

  await Promise.all([
    supabase.from("etl_mapping_items").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("etl_rule_items").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("etl_data_quality_items").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("etl_analysis_gaps").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  const { error } = await supabase.from("etl_analysis_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(error.message);
  }
}

export async function getProcessedArtifacts(projectId?: string | null, artifactIds?: string[]) {
  const supabase = getSupabaseOrThrow();
  let query = supabase.from("etl_artifacts").select("*").eq("processing_status", "processed");

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (artifactIds && artifactIds.length > 0) {
    query = query.in("id", artifactIds);
  }

  const { data, error } = await query.order("uploaded_at", { ascending: false }).limit(25);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function labelize(value?: string | null) {
  if (!value) return "Not specified";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeMappingConfidence(item: MappingItem): MappingItem {
  const current = normalizeConfidenceValue(item.confidence_score);
  if (current > 0) return { ...item, confidence_score: current };

  const hasSource = Boolean(item.source_table && item.source_column);
  const hasTarget = Boolean(item.target_table && item.target_column);
  const hasRule = Boolean(item.transformation_rule || item.business_rule || item.join_condition || item.filter_condition);

  if (hasSource && hasTarget && hasRule) return { ...item, confidence_score: 85 };
  if (hasSource && hasTarget) return { ...item, confidence_score: 75 };
  if (item.source_table || item.target_table) return { ...item, confidence_score: 60 };
  return { ...item, confidence_score: 40 };
}

export function normalizeRuleConfidence(item: RuleItem): RuleItem {
  const current = normalizeConfidenceValue(item.confidence_score);
  if (current > 0) return { ...item, confidence_score: current };

  const hasTables = Boolean(item.affected_tables?.length);
  const hasColumns = Boolean(item.affected_columns?.length);
  const hasIntent = Boolean(item.validation_intent || item.description || item.source_expression || item.target_expression);

  if (hasTables && hasColumns && hasIntent) return { ...item, confidence_score: 85 };
  if (hasTables && hasIntent) return { ...item, confidence_score: 75 };
  if (hasIntent) return { ...item, confidence_score: 60 };
  return { ...item, confidence_score: 40 };
}

export function normalizeDataQualityConfidence(item: DataQualityItem): DataQualityItem {
  const current = normalizeConfidenceValue(item.confidence_score);
  if (current > 0) return { ...item, confidence_score: current };

  const hasTarget = Boolean(item.table_name && item.column_name);
  const hasCondition = Boolean(item.expected_condition || item.suggested_validation || item.description);

  if (hasTarget && hasCondition) return { ...item, confidence_score: 85 };
  if (item.table_name && hasCondition) return { ...item, confidence_score: 70 };
  if (hasCondition) return { ...item, confidence_score: 55 };
  return { ...item, confidence_score: 40 };
}

function normalizeConfidenceValue(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
