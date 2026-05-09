"use client";

import { useRef, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";

type FileUploadDropzoneProps = {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
};

const accept = ".docx,.pdf,.xlsx,.csv,.txt";

export function FileUploadDropzone({ disabled, onFilesSelected }: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || disabled) return;
    onFilesSelected(Array.from(files));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={`rounded-2xl border border-dashed p-8 text-center transition ${
        isDragging
          ? "border-brand-teal bg-brand-teal/10"
          : "border-brand-border bg-brand-panel/75 hover:border-brand-primary/60"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
        className="sr-only"
      />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/15 text-[#7AA7FF]">
        <FileUp className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-brand-text">Upload ETL source documents</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-brand-secondary">
        Drag and drop requirements, source-to-target mappings, transformation logic, data dictionaries, SQL references,
        CSV files, or plain text notes.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-brand-secondary">
        {["DOCX", "PDF", "XLSX", "CSV", "TXT"].map((type) => (
          <span key={type} className="rounded-lg border border-brand-border bg-brand-card px-3 py-1.5">
            {type}
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UploadCloud className="h-4 w-4" aria-hidden="true" />
        Browse files
      </button>
      <p className="mt-3 text-xs text-brand-muted">Maximum supported size is 20 MB per file.</p>
    </div>
  );
}
