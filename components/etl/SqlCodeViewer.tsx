"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download } from "lucide-react";
import type { ValidationScript } from "@/lib/etl/sql";
import { labelize } from "@/lib/etl/analysis";

const keywordPattern =
  /\b(SELECT|FROM|WHERE|TRUNC|COUNT|CASE|WHEN|THEN|ROUND|ELSE|NULL|END|AS|DUAL|CROSS|JOIN|LEFT|GROUP|BY|HAVING|SUM|DISTINCT|EXISTS|NOT|ON|MINUS|EXCEPT)\b/g;

type SqlCodeViewerProps = {
  script: ValidationScript | null;
  emptyMessage?: string;
};

export function SqlCodeViewer({ script, emptyMessage = "Select a generated script to preview the SQL." }: SqlCodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => (script?.sql_text ?? "").split("\n"), [script?.sql_text]);

  async function handleCopy() {
    if (!script) return;
    await navigator.clipboard.writeText(script.sql_text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    if (!script) return;
    const blob = new Blob([script.sql_text], { type: "application/sql" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${script.script_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 shadow-panel-glow">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-brand-text">{script?.script_name ?? "Generated SQL Preview"}</h2>
          {script ? <p className="mt-1 text-xs text-brand-secondary">{script.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!script}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-sm font-semibold text-brand-secondary transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-brand-success" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!script}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-electric disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download .sql
          </button>
        </div>
      </div>

      {!script ? (
        <div className="p-8 text-center text-sm text-brand-secondary">{emptyMessage}</div>
      ) : (
        <>
          <div className="max-h-[560px] overflow-auto bg-[#03101F] px-4 py-3 font-mono text-[13px] leading-6">
            {lines.map((line, index) => (
              <div key={`${line}-${index}`} className="grid grid-cols-[2.75rem_1fr] gap-3">
                <span className="select-none text-right text-brand-muted">{index + 1}</span>
                <span
                  className="whitespace-pre text-brand-secondary"
                  dangerouslySetInnerHTML={{ __html: colorize(line) }}
                />
              </div>
            ))}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border px-4 py-3 text-xs text-brand-secondary">
            <div className="flex flex-wrap items-center gap-5">
              <span>Language: <span className="text-brand-text">{script.database_type === "oracle" ? "Oracle SQL" : "SQL"}</span></span>
              <span>Database: <span className="text-brand-text">{labelize(script.database_type)}</span></span>
              <span>Category: <span className="text-brand-text">{labelize(script.validation_category)}</span></span>
            </div>
            <span>Last generated: <span className="text-brand-text">{new Date(script.created_at).toLocaleString("en")}</span></span>
          </footer>
        </>
      )}
    </section>
  );
}

function colorize(line: string) {
  const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (escaped.trim().startsWith("--")) {
    return `<span class="text-brand-success">${escaped}</span>`;
  }

  return escaped
    .replace(keywordPattern, '<span class="text-[#63B3FF]">$1</span>')
    .replace(/'([^']+)'/g, '<span class="text-brand-warning">\'$1\'</span>')
    .replace(/(:[A-Z_]+|\{\{[A-Z_]+\}\})/g, '<span class="text-brand-teal">$1</span>');
}
