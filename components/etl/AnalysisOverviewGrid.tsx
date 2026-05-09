import Link from "next/link";
import { analysisOverview } from "@/lib/etl/mock-data";
import { icons, type IconName } from "@/components/etl/icon-map";

const accentClasses = {
  green: "bg-brand-success/15 text-brand-success",
  purple: "bg-violet-500/15 text-violet-300",
  teal: "bg-brand-teal/15 text-brand-teal",
  orange: "bg-brand-warning/15 text-brand-warning",
  blue: "bg-brand-primary/15 text-[#7AA7FF]",
  pink: "bg-fuchsia-500/15 text-fuchsia-300",
};

export function AnalysisOverviewGrid() {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-text">Extracted Analysis Overview</h2>
        <Link
          href="/mapping-analysis"
          className="text-sm font-semibold text-[#5EA1FF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
        >
          View All
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {analysisOverview.map((item) => {
          const Icon = icons[item.icon as IconName];

          return (
            <article
              key={item.label}
              className="min-h-24 rounded-xl border border-brand-border bg-brand-card/70 p-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentClasses[item.accent]}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs leading-4 text-brand-secondary">{item.label}</p>
              </div>
              <p className="mt-3 text-2xl font-bold text-brand-text">{item.count}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
