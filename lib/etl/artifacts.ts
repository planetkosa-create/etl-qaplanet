import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const ETL_ARTIFACTS_BUCKET = "etl-artifacts";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const sourceKinds = [
  "requirements",
  "source_target_mapping",
  "transformation_logic",
  "data_dictionary",
  "sql_reference",
  "other",
] as const;

export const processingStatuses = ["uploaded", "processing", "processed", "failed"] as const;
export const supportedExtensions = ["docx", "pdf", "xlsx", "csv", "txt"] as const;

export type SourceKind = (typeof sourceKinds)[number];
export type ProcessingStatus = (typeof processingStatuses)[number];
export type SupportedExtension = (typeof supportedExtensions)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EtlArtifact = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number | null;
  storage_path: string | null;
  extracted_text: string | null;
  extracted_json: JsonValue | null;
  source_kind: SourceKind;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  uploaded_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactListResult = {
  configured: boolean;
  artifacts: EtlArtifact[];
  error?: string;
};

export const sourceKindLabels: Record<SourceKind, string> = {
  requirements: "Requirements",
  source_target_mapping: "Source-to-Target Mapping",
  transformation_logic: "Transformation Logic",
  data_dictionary: "Data Dictionary",
  sql_reference: "SQL Reference",
  other: "Other",
};

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedExtension(extension: string): extension is SupportedExtension {
  return supportedExtensions.includes(extension as SupportedExtension);
}

export function isSourceKind(value: unknown): value is SourceKind {
  return typeof value === "string" && sourceKinds.includes(value as SourceKind);
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function createStoragePath(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
}

export function getFallbackMimeType(extension: string) {
  const mimeTypes: Record<string, string> = {
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdf: "application/pdf",
    txt: "text/plain",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return mimeTypes[extension] ?? "application/octet-stream";
}

export function getSupabaseOrThrow(): SupabaseClient {
  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.");
  }

  return client;
}

export async function listArtifacts(limit = 50): Promise<ArtifactListResult> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      artifacts: [],
      error: "Supabase is not configured.",
    };
  }

  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase
    .from("etl_artifacts")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      configured: true,
      artifacts: [],
      error: error.message,
    };
  }

  return {
    configured: true,
    artifacts: (data ?? []) as EtlArtifact[],
  };
}

export async function getArtifact(id: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.from("etl_artifacts").select("*").eq("id", id).single();

  if (error) {
    throw new Error(error.message);
  }

  return data as EtlArtifact;
}

export async function deleteArtifact(id: string) {
  const supabase = getSupabaseOrThrow();
  const artifact = await getArtifact(id);

  if (artifact.storage_path) {
    await supabase.storage.from(ETL_ARTIFACTS_BUCKET).remove([artifact.storage_path]);
  }

  const { error } = await supabase.from("etl_artifacts").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return artifact;
}
