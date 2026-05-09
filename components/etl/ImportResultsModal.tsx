"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function ImportResultsModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (payload: { runName: string; databaseType: string; environmentName: string; input: string }) => Promise<void>;
}) {
  const [runName, setRunName] = useState("Payments DW Smoke Validation");
  const [databaseType, setDatabaseType] = useState("oracle");
  const [environmentName, setEnvironmentName] = useState("QA");
  const [input, setInput] = useState(sampleInput);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    try {
      await onImport({ runName, databaseType, environmentName, input });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-3xl rounded-2xl border border-brand-border bg-brand-panel shadow-panel-glow">
        <header className="flex items-center justify-between border-b border-brand-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Import Execution Results</h2>
            <p className="mt-1 text-sm text-brand-secondary">Paste JSON or CSV results from manual execution.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-secondary hover:bg-brand-card hover:text-white" aria-label="Close import results">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Input label="Run Name" value={runName} onChange={setRunName} />
          <Input label="Database Type" value={databaseType} onChange={setDatabaseType} />
          <Input label="Environment" value={environmentName} onChange={setEnvironmentName} />
        </div>
        <div className="px-5">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={14} className="w-full rounded-xl border border-brand-border bg-[#03101F] p-4 font-mono text-xs text-brand-text outline-none focus:border-brand-primary" />
        </div>
        <footer className="flex justify-end gap-3 border-t border-brand-border p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-secondary hover:text-white">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || !input.trim()} className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow-blue-glow disabled:opacity-50">
            {saving ? "Importing..." : "Import Results"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-brand-text">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text" />
    </label>
  );
}

const sampleInput = `{
  "results": [
    {
      "script_name": "row_count_src_payments_stg_to_tgt_payments_dw",
      "status": "passed",
      "actual_result": "COUNT_DIFF = 0",
      "row_count": 1000,
      "difference_count": 0,
      "evidence_notes": "Source and target counts match."
    }
  ]
}`;
