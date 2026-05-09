import Link from "next/link";
import { validationPacks } from "@/lib/etl/mock-data";
import { ValidationPackCard } from "@/components/etl/ValidationPackCard";
import type { IconName } from "@/components/etl/icon-map";

export function ValidationPacksGrid() {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <h2 className="text-base font-semibold text-brand-text">Recommended Validation Packs</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {validationPacks.map((pack) => (
          <ValidationPackCard
            key={pack.title}
            title={pack.title}
            badge={pack.badge}
            checks={pack.checks}
            icon={pack.icon as IconName}
            accent={pack.accent}
          />
        ))}
      </div>
      <Link
        href="/sql-validator-generator"
        className="mt-4 inline-flex text-sm font-semibold text-[#5EA1FF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
      >
        View all validation packs →
      </Link>
    </section>
  );
}
