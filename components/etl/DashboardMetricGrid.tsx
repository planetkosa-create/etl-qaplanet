"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/etl/MetricCard";
import type { IconName } from "@/components/etl/icon-map";
import { type AnalysisSnapshot } from "@/lib/etl/analysis";
import { type EtlArtifact } from "@/lib/etl/artifacts";
import { metricCards } from "@/lib/etl/mock-data";

type ArtifactListResponse = {
  success: boolean;
  configured: boolean;
  artifacts: EtlArtifact[];
};

export function DashboardMetricGrid() {
  const [uploadedCount, setUploadedCount] = useState<string>(metricCards[0].count);
  const [uploadedStatus, setUploadedStatus] = useState<string>("Demo");
  const [rulesCount, setRulesCount] = useState<string>(metricCards[1].count);
  const [reconciliationCount, setReconciliationCount] = useState<string>(metricCards[4].count);

  useEffect(() => {
    async function loadCount() {
      try {
        const [artifactResponse, analysisResponse] = await Promise.all([
          fetch("/api/etl/artifacts", { cache: "no-store" }),
          fetch("/api/etl/analysis", { cache: "no-store" }),
        ]);
        const result = (await artifactResponse.json()) as ArtifactListResponse;
        const analysis = (await analysisResponse.json()) as AnalysisSnapshot & { success: boolean };

        if (artifactResponse.ok && result.configured) {
          setUploadedCount(String(result.artifacts.length));
          setUploadedStatus(result.artifacts.length > 0 ? "Processed" : "Ready");
        }

        if (analysisResponse.ok && analysis.success && analysis.configured) {
          setRulesCount(String(analysis.counts.rules));
          setReconciliationCount(String(analysis.counts.reconciliationRules));
        }
      } catch {
        setUploadedStatus("Demo");
      }
    }

    void loadCount();
  }, []);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {metricCards.map((metric, index) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          count={index === 0 ? uploadedCount : index === 1 ? rulesCount : index === 4 ? reconciliationCount : metric.count}
          status={index === 0 ? uploadedStatus : metric.status}
          icon={metric.icon as IconName}
          accent={metric.accent}
        />
      ))}
    </section>
  );
}
