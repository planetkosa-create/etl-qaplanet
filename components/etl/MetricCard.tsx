import { icons, type IconName } from "@/components/etl/icon-map";
import { StatusBadge } from "@/components/etl/StatusBadge";

type MetricCardProps = {
  label: string;
  count: string;
  status: string;
  icon: IconName;
  accent: "blue" | "teal" | "red";
};

const accentClasses = {
  blue: "bg-brand-primary/15 text-[#7AA7FF] border-brand-primary/20",
  teal: "bg-brand-teal/15 text-brand-teal border-brand-teal/20",
  red: "bg-brand-danger/15 text-[#FF7777] border-brand-danger/20",
};

export function MetricCard({ label, count, status, icon, accent }: MetricCardProps) {
  const Icon = icons[icon];

  return (
    <article className="rounded-2xl border border-brand-border bg-brand-card/70 p-4 shadow-panel-glow">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${accentClasses[accent]}`}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-brand-secondary">{label}</p>
          <div className="mt-1 flex items-end gap-3">
            <p className="text-3xl font-bold leading-none text-brand-text">{count}</p>
            <StatusBadge label={status} tone={status === "Processed" ? "success" : "ready"} />
          </div>
        </div>
      </div>
    </article>
  );
}
