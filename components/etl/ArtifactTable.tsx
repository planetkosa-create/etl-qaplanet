"use client";

import { RefreshCcw, Trash2, View } from "lucide-react";
import {
  formatBytes,
  formatDateTime,
  sourceKindLabels,
  type EtlArtifact,
  type ProcessingStatus,
} from "@/lib/etl/artifacts";
import { StatusBadge } from "@/components/etl/StatusBadge";

type ArtifactTableProps = {
  artifacts: EtlArtifact[];
  loading?: boolean;
  actionId?: string;
  showSourceKind?: boolean;
  compact?: boolean;
  onPreview?: (artifact: EtlArtifact) => void;
  onReprocess?: (artifact: EtlArtifact) => void;
  onDelete?: (artifact: EtlArtifact) => void;
};

export function ArtifactTable({
  artifacts,
  loading,
  actionId,
  showSourceKind = true,
  compact,
  onPreview,
  onReprocess,
  onDelete,
}: ArtifactTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">File Name</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            {showSourceKind ? <th className="px-4 py-3 font-semibold">Source Kind</th> : null}
            <th className="px-4 py-3 font-semibold">Size</th>
            <th className="px-4 py-3 font-semibold">Uploaded On</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/70">
          {artifacts.map((artifact) => {
            const isActionRunning = actionId === artifact.id;

            return (
              <tr key={artifact.id} className="text-brand-secondary transition hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <span className="font-semibold text-brand-text">{artifact.file_name}</span>
                  {artifact.processing_error ? (
                    <p className="mt-1 max-w-md truncate text-xs text-brand-danger">{artifact.processing_error}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{artifact.file_type}</td>
                {showSourceKind ? <td className="px-4 py-3">{sourceKindLabels[artifact.source_kind]}</td> : null}
                <td className="px-4 py-3">{formatBytes(artifact.file_size)}</td>
                <td className="px-4 py-3">{formatDateTime(artifact.uploaded_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={statusLabel(artifact.processing_status)} tone={statusTone(artifact.processing_status)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={loading || isActionRunning}
                      onClick={() => onPreview?.(artifact)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`View extracted text for ${artifact.file_name}`}
                    >
                      <View className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {!compact ? (
                      <>
                        <button
                          type="button"
                          disabled={loading || isActionRunning}
                          onClick={() => onReprocess?.(artifact)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-secondary transition hover:bg-brand-card hover:text-brand-warning focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Reprocess ${artifact.file_name}`}
                        >
                          <RefreshCcw className={`h-4 w-4 ${isActionRunning ? "animate-spin" : ""}`} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={loading || isActionRunning}
                          onClick={() => onDelete?.(artifact)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-secondary transition hover:bg-brand-card hover:text-brand-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${artifact.file_name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function statusTone(status: ProcessingStatus) {
  if (status === "processed") return "success";
  if (status === "failed") return "danger";
  if (status === "processing") return "processing";
  return "neutral";
}

function statusLabel(status: ProcessingStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
