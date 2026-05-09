"use client";

import { useState } from "react";
import { icons, type IconName } from "@/components/etl/icon-map";

type ValidationPackCardProps = {
  title: string;
  badge: string;
  checks: string;
  icon: IconName;
  accent: "blue" | "green" | "orange" | "red";
};

const accentClasses = {
  blue: "bg-brand-primary/15 text-[#7AA7FF]",
  green: "bg-brand-success/15 text-brand-success",
  orange: "bg-brand-warning/15 text-brand-warning",
  red: "bg-brand-danger/15 text-[#FF8888]",
};

export function ValidationPackCard({ title, badge, checks, icon, accent }: ValidationPackCardProps) {
  const [selected, setSelected] = useState(false);
  const Icon = icons[icon];

  return (
    <label
      className={`relative block min-h-24 cursor-pointer rounded-xl border bg-brand-card/70 p-3 transition hover:border-brand-primary/70 ${
        selected ? "border-brand-primary shadow-blue-glow" : "border-brand-border"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => setSelected(event.target.checked)}
        className="absolute right-3 top-3 h-4 w-4 rounded border-brand-border bg-brand-panel text-brand-primary focus:ring-brand-teal"
        aria-label={`Select ${title}`}
      />
      <div className="flex items-start gap-3 pr-7">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-5 text-brand-text">{title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-brand-primary/30 bg-brand-primary/15 px-2 py-1 text-xs font-semibold text-[#7AA7FF]">
              {badge}
            </span>
            <span className="text-xs text-brand-secondary">{checks}</span>
          </div>
        </div>
      </div>
    </label>
  );
}
