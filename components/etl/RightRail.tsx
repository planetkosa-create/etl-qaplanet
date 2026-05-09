import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { etlTeamNeeds, securityItems } from "@/lib/etl/mock-data";
import { icons, type IconName } from "@/components/etl/icon-map";

export function RightRail() {
  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-5 shadow-panel-glow">
        <h2 className="text-base font-semibold text-[#5EA1FF]">What ETL Teams Need</h2>
        <div className="mt-5 space-y-5">
          {etlTeamNeeds.map((item) => {
            const Icon = icons[item.icon as IconName];

            return (
              <article key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-border text-brand-secondary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-brand-text">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-brand-secondary">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-5 shadow-panel-glow">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-electric">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-[#5EA1FF]">Security & Compliance</h2>
        </div>
        <ul className="mt-5 space-y-4">
          {securityItems.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-brand-secondary">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-success" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/settings"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5EA1FF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
        >
          Learn more about security <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </aside>
  );
}
