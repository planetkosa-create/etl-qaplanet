import { FileSpreadsheet, FileText, MoreVertical } from "lucide-react";
import { uploadedArtifacts } from "@/lib/etl/mock-data";
import { StatusBadge } from "@/components/etl/StatusBadge";

const fileTypeClasses = {
  DOCX: "bg-brand-primary/15 text-[#7AA7FF]",
  XLSX: "bg-brand-success/15 text-brand-success",
  PDF: "bg-brand-danger/15 text-[#FF7777]",
  CSV: "bg-brand-teal/15 text-brand-teal",
};

export function UploadedArtifactsTable() {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 shadow-panel-glow">
      <div className="border-b border-brand-border px-4 py-3">
        <h2 className="text-base font-semibold text-brand-text">Uploaded Artifacts</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-brand-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">File Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Uploaded On</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/70">
            {uploadedArtifacts.map((artifact) => {
              const Icon = artifact.type === "XLSX" || artifact.type === "CSV" ? FileSpreadsheet : FileText;

              return (
                <tr key={artifact.fileName} className="text-brand-secondary transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-brand-text">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${fileTypeClasses[artifact.type]}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="font-medium">{artifact.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{artifact.type}</td>
                  <td className="px-4 py-3">{artifact.size}</td>
                  <td className="px-4 py-3">{artifact.uploadedOn}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={artifact.status} tone="success" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
                      aria-label={`Open actions for ${artifact.fileName}`}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
