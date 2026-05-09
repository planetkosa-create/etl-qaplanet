"use client";

import { X } from "lucide-react";
import { formatBytes, formatDateTime, sourceKindLabels, type EtlArtifact } from "@/lib/etl/artifacts";
import { StatusBadge } from "@/components/etl/StatusBadge";

type ArtifactPreviewDrawerProps = {
  artifact: EtlArtifact | null;
  onClose: () => void;
};

export function ArtifactPreviewDrawer({ artifact, onClose }: ArtifactPreviewDrawerProps) {
  if (!artifact) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-brand-border bg-brand-background shadow-panel-glow">
        <header className="flex items-start justify-between gap-4 border-b border-brand-border p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
              {sourceKindLabels[artifact.source_kind]}
            </p>
            <h2 className="mt-1 truncate text-xl font-bold text-brand-text">{artifact.file_name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-brand-secondary">
              <span>{artifact.file_type}</span>
              <span>{formatBytes(artifact.file_size)}</span>
              <span>{formatDateTime(artifact.uploaded_at)}</span>
              <StatusBadge
                label={artifact.processing_status}
                tone={artifact.processing_status === "processed" ? "success" : artifact.processing_status === "failed" ? "danger" : "processing"}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
            aria-label="Close extracted text preview"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {artifact.processing_error ? (
            <div className="mb-4 rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-[#FFB4B4]">
              {artifact.processing_error}
            </div>
          ) : null}

          <section>
            <h3 className="text-sm font-semibold text-brand-text">Extracted Text</h3>
            <pre className="mt-3 max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-border bg-[#03101F] p-4 font-mono text-xs leading-6 text-brand-secondary">
              {artifact.extracted_text || "No extracted text is available yet."}
            </pre>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-brand-text">Structured JSON</h3>
            <pre className="mt-3 max-h-[34vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-border bg-brand-card/70 p-4 font-mono text-xs leading-6 text-brand-secondary">
              {artifact.extracted_json ? JSON.stringify(artifact.extracted_json, null, 2) : "No structured JSON is available yet."}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
