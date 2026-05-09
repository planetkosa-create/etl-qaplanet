"use client";

import { Download, X } from "lucide-react";

export function AuditReportPreview({
  open,
  content,
  fileName,
  onClose,
}: {
  open: boolean;
  content: string;
  fileName: string;
  onClose: () => void;
}) {
  if (!open) return null;

  function download() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "etl-validation-audit-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-brand-border bg-brand-panel shadow-panel-glow">
        <header className="flex items-center justify-between border-b border-brand-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Audit Report Preview</h2>
            <p className="mt-1 text-sm text-brand-secondary">{fileName}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
              <Download className="h-4 w-4" />
              Download
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-secondary hover:bg-brand-card hover:text-white" aria-label="Close audit report">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <pre className="overflow-auto whitespace-pre-wrap p-5 text-sm leading-6 text-brand-text">{content}</pre>
      </section>
    </div>
  );
}
