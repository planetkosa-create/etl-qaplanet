import { NextResponse } from "next/server";
import {
  ETL_ARTIFACTS_BUCKET,
  getArtifact,
  getFallbackMimeType,
  getSupabaseOrThrow,
  type JsonValue,
} from "@/lib/etl/artifacts";
import { parseArtifact } from "@/lib/etl/artifact-parser";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

  const supabase = getSupabaseOrThrow();

  try {
    const { id } = await context.params;
    const artifact = await getArtifact(id);

    if (!artifact.storage_path) {
      throw new Error("This artifact does not have a stored file to reprocess.");
    }

    await supabase
      .from("etl_artifacts")
      .update({
        processing_status: "processing",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    const { data, error: downloadError } = await supabase.storage.from(ETL_ARTIFACTS_BUCKET).download(artifact.storage_path);

    if (downloadError || !data) {
      throw new Error(`Stored file could not be downloaded: ${downloadError?.message ?? "Unknown storage error."}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const parsed = await parseArtifact(buffer, artifact.file_name, getFallbackMimeType(artifact.file_type.toLowerCase()));
    const { data: processed, error: updateError } = await supabase
      .from("etl_artifacts")
      .update({
        extracted_text: parsed.extractedText,
        extracted_json: parsed.extractedJson as JsonValue,
        processing_status: "processed",
        processing_error: null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      configured: true,
      artifact: processed,
    });
  } catch (error) {
    const { id } = await context.params;
    const message = error instanceof Error ? error.message : "Reprocessing failed.";

    await supabase
      .from("etl_artifacts")
      .update({
        processing_status: "failed",
        processing_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

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
