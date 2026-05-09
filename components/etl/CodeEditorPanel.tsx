"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { sqlSample } from "@/lib/etl/mock-data";

const tabs = ["All", "SQL", "Oracle"];
const keywordPattern =
  /\b(SELECT|FROM|WHERE|TRUNC|COUNT|CASE|WHEN|THEN|ROUND|ELSE|NULL|END|AS|DUAL)\b/g;

function colorize(line: string) {
  const escaped = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (escaped.trim().startsWith("--")) {
    return `<span class="text-brand-success">${escaped}</span>`;
  }

  return escaped
    .replace(keywordPattern, '<span class="text-[#63B3FF]">$1</span>')
    .replace(/'([^']+)'/g, '<span class="text-brand-warning">\'$1\'</span>')
    .replace(/(:[A-Z_]+)/g, '<span class="text-brand-teal">$1</span>');
}

export function CodeEditorPanel() {
  const [activeTab, setActiveTab] = useState("All");
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => sqlSample.split("\n"), []);

  async function handleCopy() {
    await navigator.clipboard.writeText(sqlSample);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 shadow-panel-glow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
        <h2 className="text-base font-semibold text-brand-text">Generated Validation SQL</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-brand-border bg-brand-background/70 p-1" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal ${
                  activeTab === tab
                    ? "bg-brand-primary text-white shadow-blue-glow"
                    : "text-brand-secondary hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          >
            {copied ? <Check className="h-4 w-4 text-brand-success" /> : <Clipboard className="h-4 w-4" />}
            {copied ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      <div className="max-h-[390px] overflow-auto bg-[#03101F] px-4 py-3 font-mono text-[13px] leading-6">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="grid grid-cols-[2.5rem_1fr] gap-3">
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
          <span>
            Language: <span className="text-brand-text">Oracle SQL</span>
          </span>
          <span>
            Database: <span className="text-brand-text">Oracle 19c</span>
          </span>
        </div>
        <span>
          Rows: <span className="text-brand-text">200</span>
        </span>
      </footer>
    </section>
  );
}
