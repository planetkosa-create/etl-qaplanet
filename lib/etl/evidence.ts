import { getSupabaseOrThrow } from "@/lib/etl/artifacts";
import type { EvidenceFile } from "@/lib/etl/execution";

const maxEvidenceSize = 20 * 1024 * 1024;
const allowedExtensions = new Set(["csv", "xlsx", "txt", "log", "png", "jpg", "jpeg", "pdf"]);
const allowedEvidenceTypes = new Set(["query_result_csv", "screenshot", "log_file", "spreadsheet", "manual_note", "other"]);

export type UploadEvidenceInput = {
  projectId?: string | null;
  executionRunId: string;
  executionResultId?: string | null;
  scriptId?: string | null;
  evidenceType?: string | null;
  notes?: string | null;
  file: File;
};

export async function uploadEvidenceFile(input: UploadEvidenceInput, userId: string) {
  validateEvidenceFile(input.file);
  const supabase = getSupabaseOrThrow();
  const evidenceType = allowedEvidenceTypes.has(input.evidenceType ?? "") ? input.evidenceType : "other";
  const storagePath = buildEvidenceStoragePath(userId, input.executionRunId, input.file.name);
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("etl-evidence")
    .upload(storagePath, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      uploadError.message.includes("Bucket not found")
        ? "Evidence storage bucket is not configured. Create Supabase Storage bucket etl-evidence."
        : uploadError.message,
    );
  }

  const { data, error } = await supabase
    .from("etl_evidence_files")
    .insert({
      project_id: input.projectId ?? null,
      user_id: userId,
      execution_run_id: input.executionRunId,
      execution_result_id: input.executionResultId ?? null,
      script_id: input.scriptId ?? null,
      file_name: input.file.name,
      file_type: getExtension(input.file.name).toUpperCase(),
      file_size: input.file.size,
      storage_path: storagePath,
      evidence_type: evidenceType,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Evidence metadata could not be saved.");
  return data as EvidenceFile;
}

export async function getEvidenceFiles(filters?: {
  projectId?: string | null;
  executionRunId?: string | null;
  executionResultId?: string | null;
}) {
  const supabase = getSupabaseOrThrow();
  let query = supabase.from("etl_evidence_files").select("*");
  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.executionRunId) query = query.eq("execution_run_id", filters.executionRunId);
  if (filters?.executionResultId) query = query.eq("execution_result_id", filters.executionResultId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EvidenceFile[];
}

export async function downloadEvidence(storagePath: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.storage.from("etl-evidence").download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function validateEvidenceFile(file: File) {
  if (file.size > maxEvidenceSize) {
    throw new Error("File is too large. Maximum supported size is 20 MB.");
  }

  const extension = getExtension(file.name);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Unsupported evidence file type. Upload CSV, XLSX, TXT, LOG, PNG, JPG, or PDF.");
  }
}

function buildEvidenceStoragePath(userId: string, runId: string, fileName: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${userId}/${runId}/${stamp}-${safeFileName(fileName)}`;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "evidence-file";
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}
