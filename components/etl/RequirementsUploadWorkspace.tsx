"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCcw } from "lucide-react";
import { ArtifactPreviewDrawer } from "@/components/etl/ArtifactPreviewDrawer";
import { ArtifactTable } from "@/components/etl/ArtifactTable";
import { FileUploadDropzone } from "@/components/etl/FileUploadDropzone";
import { SourceKindSelect } from "@/components/etl/SourceKindSelect";
import { sourceKindLabels, type EtlArtifact, type SourceKind } from "@/lib/etl/artifacts";

type ArtifactListResponse = {
  success: boolean;
  configured: boolean;
  artifacts: EtlArtifact[];
  error?: string;
};

export function RequirementsUploadWorkspace() {
  const [artifacts, setArtifacts] = useState<EtlArtifact[]>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("requirements");
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewArtifact, setPreviewArtifact] = useState<EtlArtifact | null>(null);

  useEffect(() => {
    void loadArtifacts();
  }, []);

  async function loadArtifacts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/etl/artifacts", { cache: "no-store" });
      const result = (await response.json()) as ArtifactListResponse;
      setConfigured(result.configured);

      if (!response.ok || !result.success) {
        setError(result.error ?? "Uploaded artifacts could not be loaded.");
      }

      setArtifacts(result.artifacts ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Uploaded artifacts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(files: File[]) {
    setUploading(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("sourceKind", sourceKind);
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/etl/artifacts", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as ArtifactListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Upload failed.");
      }

      setArtifacts((current) => [...result.artifacts, ...current]);
      setMessage(`${files.length} file${files.length === 1 ? "" : "s"} uploaded as ${sourceKindLabels[sourceKind]}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleReprocess(artifact: EtlArtifact) {
    setActionId(artifact.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/etl/artifacts/${artifact.id}/reprocess`, {
        method: "POST",
      });
      const result = (await response.json()) as { success: boolean; artifact?: EtlArtifact; error?: string };

      if (!response.ok || !result.success || !result.artifact) {
        throw new Error(result.error ?? "Reprocess failed.");
      }

      setArtifacts((current) => current.map((item) => (item.id === artifact.id ? result.artifact! : item)));
      setMessage(`${artifact.file_name} was reprocessed.`);
    } catch (reprocessError) {
      setError(reprocessError instanceof Error ? reprocessError.message : "Reprocess failed.");
      await loadArtifacts();
    } finally {
      setActionId(undefined);
    }
  }

  async function handleDelete(artifact: EtlArtifact) {
    setActionId(artifact.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/etl/artifacts/${artifact.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Delete failed.");
      }

      setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
      setPreviewArtifact((current) => (current?.id === artifact.id ? null : current));
      setMessage(`${artifact.file_name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setActionId(undefined);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          Phase 2
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">Requirements Upload</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">
          Upload ETL BRDs, source-to-target mappings, transformation rules, PDFs, spreadsheets, data dictionaries, CSVs,
          and TXT files. ETL QAplanet extracts readable content and stores it for Phase 3 analysis.
        </p>
      </section>

      {!configured ? (
        <section className="rounded-2xl border border-brand-warning/30 bg-brand-warning/10 p-4 text-sm text-brand-warning">
          Supabase is not configured for this deployment yet. Add the Supabase environment variables and run the SQL setup
          script before uploading files.
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">
          {error}
        </section>
      ) : null}

      {message ? (
        <section className="rounded-2xl border border-brand-success/30 bg-brand-success/10 p-4 text-sm text-brand-success">
          {message}
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <FileUploadDropzone disabled={uploading || !configured} onFilesSelected={handleUpload} />
        <div className="rounded-2xl border border-brand-border bg-brand-panel/75 p-5 shadow-panel-glow">
          <SourceKindSelect value={sourceKind} onChange={setSourceKind} disabled={uploading || !configured} />
          <div className="mt-5 rounded-xl border border-brand-border bg-brand-card/70 p-4">
            <div className="flex items-center gap-3 text-sm font-semibold text-brand-text">
              <Database className="h-5 w-5 text-brand-teal" aria-hidden="true" />
              Stored for AI analysis
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-secondary">
              Files are saved in Supabase Storage and extracted text/table content is saved in the `etl_artifacts` table.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || uploading}
            onClick={loadArtifacts}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh artifacts
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 shadow-panel-glow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-brand-text">Uploaded Artifacts</h2>
            <p className="mt-1 text-xs text-brand-secondary">Real files stored in Supabase for Phase 3 AI extraction.</p>
          </div>
          {uploading ? <span className="text-sm font-semibold text-[#7AA7FF]">Uploading and parsing...</span> : null}
        </div>

        {loading ? (
          <div className="p-6 text-sm text-brand-secondary">Loading uploaded artifacts...</div>
        ) : artifacts.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-semibold text-brand-text">No ETL artifacts uploaded yet</h3>
            <p className="mt-2 text-sm text-brand-secondary">Upload requirements or mapping files to begin.</p>
          </div>
        ) : (
          <ArtifactTable
            artifacts={artifacts}
            loading={uploading}
            actionId={actionId}
            onPreview={setPreviewArtifact}
            onReprocess={handleReprocess}
            onDelete={handleDelete}
          />
        )}
      </section>

      <ArtifactPreviewDrawer artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
    </div>
  );
}
