"use client";

import { sourceKindLabels, sourceKinds, type SourceKind } from "@/lib/etl/artifacts";

type SourceKindSelectProps = {
  value: SourceKind;
  onChange: (value: SourceKind) => void;
  disabled?: boolean;
};

export function SourceKindSelect({ value, onChange, disabled }: SourceKindSelectProps) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-brand-text">Source Kind</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SourceKind)}
        className="mt-2 w-full rounded-xl border border-brand-border bg-brand-card px-4 py-3 text-sm text-brand-text transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sourceKinds.map((kind) => (
          <option key={kind} value={kind}>
            {sourceKindLabels[kind]}
          </option>
        ))}
      </select>
    </label>
  );
}
