import { NextResponse } from "next/server";
import { runEtlAnalysisForArtifacts, saveEtlAnalysisResults } from "@/lib/etl/ai-analysis";
import { getProcessedArtifacts } from "@/lib/etl/analysis";
import { getSupabaseOrThrow, type EtlArtifact } from "@/lib/etl/artifacts";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RunRequest = {
  projectId?: string;
  artifactIds?: string[];
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "Supabase is not configured.",
      },
      { status: 503 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: "AI analysis is not configured. Please set OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseOrThrow();
  let runId: string | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as RunRequest;
    const artifacts = (await getProcessedArtifacts(body.projectId, body.artifactIds)) as EtlArtifact[];

    if (artifacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "No processed ETL artifacts are available for analysis.",
        },
        { status: 400 },
      );
    }

    const { data: run, error: runError } = await supabase
      .from("etl_analysis_runs")
      .insert({
        project_id: body.projectId ?? null,
        run_name: `ETL Analysis ${new Date().toLocaleString("en")}`,
        status: "running",
        artifact_count: artifacts.length,
        model_name: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input_summary: artifacts.map((artifact) => `${artifact.file_name} (${artifact.source_kind})`).join(", "),
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (runError || !run) {
      throw new Error(runError?.message ?? "Analysis run could not be created.");
    }

    runId = run.id;
    const result = await runEtlAnalysisForArtifacts(artifacts);
    await saveEtlAnalysisResults(run.id, result);

    const counts = {
      mappings: result.mappings.length,
      rules: result.rules.length,
      dataQualityChecks: result.data_quality_checks.length,
      gaps: result.gaps.length,
    };

    const { error: updateError } = await supabase
      .from("etl_analysis_runs")
      .update({
        status: "completed",
        output_summary: result.summary.description,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      configured: true,
      analysisRunId: runId,
      counts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";

    if (runId) {
      await supabase
        .from("etl_analysis_runs")
        .update({
          status: "failed",
          processing_error: message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: message,
      },
      { status: 500 },
    );
  }
}
