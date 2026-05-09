import { NextResponse } from "next/server";
import {
  createStoragePath,
  ETL_ARTIFACTS_BUCKET,
  getFileExtension,
  getFallbackMimeType,
  getSupabaseOrThrow,
  isSourceKind,
  isSupportedExtension,
  listArtifacts,
  MAX_UPLOAD_BYTES,
  type EtlArtifact,
  type JsonValue,
  type SourceKind,
} from "@/lib/etl/artifacts";
import { parseArtifact } from "@/lib/etl/artifact-parser";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const result = await listArtifacts();

  return NextResponse.json({
    success: result.configured ? !result.error : true,
    ...result,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const sourceKindValue = formData.get("sourceKind");
    const sourceKind: SourceKind = isSourceKind(sourceKindValue) ? sourceKindValue : "other";
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Select at least one ETL artifact to upload.",
        },
        { status: 400 },
      );
    }

    const artifacts: EtlArtifact[] = [];

    for (const file of files) {
      const artifact = await processUpload(file, sourceKind);
      artifacts.push(artifact);
    }

    return NextResponse.json({
      success: true,
      configured: true,
      artifacts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: error instanceof Error ? error.message : "Upload failed. Try again.",
      },
      { status: 500 },
    );
  }
}

async function processUpload(file: File, sourceKind: SourceKind) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large. Maximum supported size is 20 MB.");
  }

  const extension = getFileExtension(file.name);

  if (!isSupportedExtension(extension)) {
    throw new Error("Unsupported file type. Upload DOCX, PDF, XLSX, CSV, or TXT files.");
  }

  const supabase = getSupabaseOrThrow();
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = createStoragePath(file.name);

  const { error: storageError } = await supabase.storage.from(ETL_ARTIFACTS_BUCKET).upload(storagePath, fileBuffer, {
    contentType: file.type || getFallbackMimeType(extension),
    upsert: false,
  });

  if (storageError) {
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("etl_artifacts")
    .insert({
      file_name: file.name,
      file_type: extension.toUpperCase(),
      file_size: file.size,
      storage_path: storagePath,
      source_kind: sourceKind,
      processing_status: "processing",
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from(ETL_ARTIFACTS_BUCKET).remove([storagePath]);
    throw new Error(`Artifact metadata could not be saved: ${insertError.message}`);
  }

  try {
    const parsed = await parseArtifact(fileBuffer, file.name, file.type || getFallbackMimeType(extension));
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
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return processed as EtlArtifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parsing failed.";
    const { data: failed } = await supabase
      .from("etl_artifacts")
      .update({
        processing_status: "failed",
        processing_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    return (failed ?? inserted) as EtlArtifact;
  }
}
