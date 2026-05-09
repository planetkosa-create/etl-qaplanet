import { CheckCircle2 } from "lucide-react";

type StatusBadgeProps = {
  label: string;
  tone?: "success" | "ready" | "warning" | "danger" | "neutral";
};

const toneClasses = {
  success: "border-brand-success/30 bg-brand-success/10 text-brand-success",
  ready: "border-brand-teal/30 bg-brand-teal/10 text-brand-success",
  warning: "border-brand-warning/30 bg-brand-warning/10 text-brand-warning",
  danger: "border-brand-danger/30 bg-brand-danger/10 text-brand-danger",
  neutral: "border-brand-border bg-brand-panel text-brand-secondary",
};

export function StatusBadge({ label, tone = "success" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
