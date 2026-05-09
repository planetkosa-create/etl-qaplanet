"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { validationPacks } from "@/lib/etl/mock-data";
import { ValidationPackCard } from "@/components/etl/ValidationPackCard";
import type { IconName } from "@/components/etl/icon-map";
import type { SqlSnapshot, ValidationPack } from "@/lib/etl/sql";

const packIconMap: Record<string, IconName> = {
  row_count_reconciliation: "Rows3",
  sum_amount_validation: "ChartNoAxesCombined",
  duplicate_detection: "PanelsTopLeft",
  primary_key_integrity: "KeyRound",
  null_handling_validation: "Braces",
  transformation_logic_checks: "Landmark",
  oracle_validation_pack: "Database",
  full_validation_suite: "FileArchive",
};

export function ValidationPacksGrid() {
  const [realPacks, setRealPacks] = useState<ValidationPack[]>([]);

  useEffect(() => {
    async function loadPacks() {
      try {
        const response = await fetch("/api/etl/sql/packs", { cache: "no-store" });
        const result = (await response.json()) as Pick<SqlSnapshot, "packs"> & { success: boolean };
        if (response.ok && result.success) setRealPacks(result.packs ?? []);
      } catch {
        setRealPacks([]);
      }
    }

    void loadPacks();
  }, []);

  const packsToShow = realPacks.length > 0 ? realPacks.slice(0, 6) : [];

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-4 shadow-panel-glow">
      <h2 className="text-base font-semibold text-brand-text">Recommended Validation Packs</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {packsToShow.length > 0 ? packsToShow.map((pack) => (
          <ValidationPackCard
            key={pack.id}
            title={pack.pack_name}
            badge={pack.database_type?.toUpperCase() ?? "SQL"}
            checks={`${pack.script_count} Checks`}
            icon={packIconMap[pack.pack_type] ?? "FileArchive"}
            accent={pack.database_type === "oracle" ? "red" : "blue"}
          />
        )) : validationPacks.map((pack) => (
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
