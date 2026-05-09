"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { labelize } from "@/lib/etl/analysis";
import type { ValidationPack, ValidationScript } from "@/lib/etl/sql";

export function NewExecutionRunModal({
  open,
  scripts,
  packs,
  onClose,
  onCreate,
}: {
  open: boolean;
  scripts: ValidationScript[];
  packs: ValidationPack[];
  onClose: () => void;
  onCreate: (payload: {
    runName: string;
    environmentName: string;
    databaseType: string;
    validationPackId?: string;
    scriptIds?: string[];
    executionMethod: "manual";
  }) => Promise<void>;
}) {
  const [runName, setRunName] = useState("Payments DW Validation Run");
  const [environmentName, setEnvironmentName] = useState("QA");
  const [databaseType, setDatabaseType] = useState("oracle");
  const [validationPackId, setValidationPackId] = useState("");
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const filteredScripts = useMemo(() => scripts.filter((script) => !databaseType || script.database_type === databaseType), [scripts, databaseType]);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    try {
      await onCreate({
        runName,
        environmentName,
        databaseType,
        validationPackId: validationPackId || undefined,
        scriptIds: validationPackId ? undefined : selectedScriptIds,
        executionMethod: "manual",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-3xl rounded-2xl border border-brand-border bg-brand-panel shadow-panel-glow">
        <header className="flex items-center justify-between border-b border-brand-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-brand-text">New Execution Run</h2>
            <p className="mt-1 text-sm text-brand-secondary">Create a manual run from a validation pack or selected scripts.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-secondary hover:bg-brand-card hover:text-white" aria-label="Close new execution run">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Run Name" value={runName} onChange={setRunName} />
          <Field label="Environment Name" value={environmentName} onChange={setEnvironmentName} />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-brand-text">Database Type</span>
            <select value={databaseType} onChange={(event) => setDatabaseType(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text">
              {["oracle", "generic_sql", "postgres", "sql_server", "snowflake", "bigquery"].map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-brand-text">Validation Pack</span>
            <select value={validationPackId} onChange={(event) => setValidationPackId(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text">
              <option value="">Select individual scripts</option>
              {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.pack_name}</option>)}
            </select>
          </label>
        </div>

        {!validationPackId ? (
          <div className="mx-5 max-h-72 overflow-auto rounded-xl border border-brand-border">
            {filteredScripts.length === 0 ? (
              <p className="p-4 text-sm text-brand-secondary">No generated scripts are available for this database type.</p>
            ) : filteredScripts.map((script) => (
              <label key={script.id} className="flex items-center gap-3 border-b border-brand-border/70 px-4 py-3 text-sm text-brand-secondary last:border-b-0">
                <input type="checkbox" checked={selectedScriptIds.includes(script.id)} onChange={() => setSelectedScriptIds((current) => current.includes(script.id) ? current.filter((id) => id !== script.id) : [...current, script.id])} className="h-4 w-4 accent-brand-primary" />
                <span className="font-semibold text-brand-text">{script.script_name}</span>
                <span>{labelize(script.validation_category)}</span>
              </label>
            ))}
          </div>
        ) : null}

        <footer className="flex justify-end gap-3 border-t border-brand-border p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-secondary hover:text-white">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || (!validationPackId && selectedScriptIds.length === 0)} className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow-blue-glow disabled:opacity-50">
            {saving ? "Creating..." : "Create Run"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-brand-text">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-3 text-sm text-brand-text" />
    </label>
  );
}
