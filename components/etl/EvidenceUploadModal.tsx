"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { labelize } from "@/lib/etl/analysis";
import type { ExecutionResult } from "@/lib/etl/execution";

export function EvidenceUploadModal({
  open,
  result,
  onClose,
  onUpload,
}: {
  open: boolean;
  result: ExecutionResult | null;
  onClose: () => void;
  onUpload: (payload: { file: File; evidenceType: string; notes: string; result: ExecutionResult }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState("query_result_csv");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !result) return null;

  async function submit() {
    if (!file || !result) return;
    setSaving(true);
    try {
      await onUpload({ file, evidenceType, notes, result });
      setFile(null);
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-xl rounded-2xl border border-brand-border bg-brand-panel shadow-panel-glow">
        <header className="flex items-center justify-between border-b border-brand-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Add Evidence</h2>
            <p className="mt-1 text-sm text-brand-secondary">{result.script_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-secondary hover:bg-brand-card hover:text-white" aria-label="Close evidence upload">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-brand-text">Evidence Type</span>
            <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text">
              {["query_result_csv", "screenshot", "log_file", "spreadsheet", "manual_note", "other"].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
          </label>
          <label className="block rounded-xl border border-dashed border-brand-primary/50 bg-brand-card/70 p-5 text-center text-sm text-brand-secondary">
            <input type="file" accept=".csv,.xlsx,.txt,.log,.png,.jpg,.jpeg,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
            {file ? file.name : "Choose CSV, XLSX, TXT, LOG, PNG, JPG, or PDF evidence"}
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-brand-text">Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text" />
          </label>
        </div>
        <footer className="flex justify-end gap-3 border-t border-brand-border p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-secondary hover:text-white">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || !file} className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow-blue-glow disabled:opacity-50">
            {saving ? "Uploading..." : "Upload Evidence"}
          </button>
        </footer>
      </section>
    </div>
  );
}
