import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";

type StatusBadgeProps = {
  label: string;
  tone?: "success" | "ready" | "warning" | "danger" | "neutral" | "processing";
};

const toneClasses = {
  success: "border-brand-success/30 bg-brand-success/10 text-brand-success",
  ready: "border-brand-teal/30 bg-brand-teal/10 text-brand-success",
  warning: "border-brand-warning/30 bg-brand-warning/10 text-brand-warning",
  danger: "border-brand-danger/30 bg-brand-danger/10 text-brand-danger",
  neutral: "border-brand-border bg-brand-panel text-brand-secondary",
  processing: "border-brand-primary/30 bg-brand-primary/10 text-[#7AA7FF]",
};

export function StatusBadge({ label, tone = "success" }: StatusBadgeProps) {
  const Icon =
    tone === "danger" ? AlertCircle : tone === "warning" ? Clock3 : tone === "processing" ? LoaderCircle : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <Icon className={`h-3 w-3 ${tone === "processing" ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
    </span>
  );
}
