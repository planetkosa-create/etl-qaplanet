"use client";

import type { LucideIcon } from "lucide-react";

export function ExportPackageCard({
  title,
  description,
  icon: Icon,
  active,
  onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl border p-4 text-left transition ${active ? "border-brand-primary bg-brand-primary/15" : "border-brand-border bg-brand-card/70 hover:border-brand-primary/60"}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-[#7AA7FF]" />
        <div>
          <h3 className="text-sm font-semibold text-brand-text">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-brand-secondary">{description}</p>
        </div>
      </div>
    </button>
  );
}
