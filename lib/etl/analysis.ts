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

    const ruleItems = (rules.data ?? []) as RuleItem[];

    return {
      configured: true,
      latestRun,
      runs: (runs ?? []) as AnalysisRun[],
      mappings: (mappings.data ?? []) as MappingItem[],
      rules: ruleItems,
      dataQualityChecks: (checks.data ?? []) as DataQualityItem[],
      gaps: (gaps.data ?? []) as AnalysisGap[],
      counts: {
        mappings: mappings.data?.length ?? 0,
        rules: ruleItems.length,
        dataQualityChecks: checks.data?.length ?? 0,
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
