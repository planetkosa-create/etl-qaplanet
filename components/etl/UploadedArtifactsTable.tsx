"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtifactPreviewDrawer } from "@/components/etl/ArtifactPreviewDrawer";
import { ArtifactTable } from "@/components/etl/ArtifactTable";
import { type EtlArtifact } from "@/lib/etl/artifacts";
import { uploadedArtifacts } from "@/lib/etl/mock-data";

type ArtifactListResponse = {
  success: boolean;
  configured: boolean;
  artifacts: EtlArtifact[];
  error?: string;
};

export function UploadedArtifactsTable() {
  const [artifacts, setArtifacts] = useState<EtlArtifact[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewArtifact, setPreviewArtifact] = useState<EtlArtifact | null>(null);

  useEffect(() => {
    async function loadArtifacts() {
      try {
        const response = await fetch("/api/etl/artifacts", { cache: "no-store" });
        const result = (await response.json()) as ArtifactListResponse;
        setConfigured(result.configured);

        if (!response.ok || !result.success) {
          setError(result.error ?? "Artifacts could not be loaded.");
        }

        setArtifacts(result.artifacts ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Artifacts could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void loadArtifacts();
  }, []);

  const sampleArtifacts = uploadedArtifacts.map((artifact, index) => ({
    id: `sample-${index}`,
    project_id: null,
    user_id: null,
    file_name: artifact.fileName,
    file_type: artifact.type,
    file_size: null,
    storage_path: null,
    extracted_text: "Sample demo artifact. Configure Supabase and upload files to replace this row with real ETL content.",
    extracted_json: null,
    source_kind: "requirements",
    processing_status: "processed",
    processing_error: null,
    uploaded_at: new Date("2024-05-20T10:21:00").toISOString(),
    processed_at: new Date("2024-05-20T10:22:00").toISOString(),
    created_at: new Date("2024-05-20T10:21:00").toISOString(),
    updated_at: new Date("2024-05-20T10:22:00").toISOString(),
  })) satisfies EtlArtifact[];

  const shouldShowDemo = !configured && artifacts.length === 0;
  const tableArtifacts = shouldShowDemo ? sampleArtifacts : artifacts.slice(0, 6);

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 shadow-panel-glow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-brand-text">Uploaded Artifacts</h2>
          {shouldShowDemo ? <p className="mt-1 text-xs text-brand-warning">Sample/demo data shown until Supabase is configured.</p> : null}
          {error && configured ? <p className="mt-1 text-xs text-brand-danger">{error}</p> : null}
        </div>
        <Link
          href="/requirements-upload"
          className="text-sm font-semibold text-[#5EA1FF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
        >
          Upload files
        </Link>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-brand-secondary">Loading uploaded artifacts...</div>
      ) : tableArtifacts.length === 0 ? (
        <div className="p-8 text-center">
          <h3 className="text-base font-semibold text-brand-text">No ETL artifacts uploaded yet</h3>
          <p className="mt-2 text-sm text-brand-secondary">Upload requirements or mapping files to begin.</p>
        </div>
      ) : (
        <ArtifactTable
          artifacts={tableArtifacts}
          compact
          showSourceKind={false}
          onPreview={setPreviewArtifact}
        />
      )}

      <ArtifactPreviewDrawer artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
    </section>
  );
}
