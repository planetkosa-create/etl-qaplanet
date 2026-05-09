"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/etl/MetricCard";
import type { IconName } from "@/components/etl/icon-map";
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

  useEffect(() => {
    async function loadCount() {
      try {
        const response = await fetch("/api/etl/artifacts", { cache: "no-store" });
        const result = (await response.json()) as ArtifactListResponse;

        if (response.ok && result.configured) {
          setUploadedCount(String(result.artifacts.length));
          setUploadedStatus(result.artifacts.length > 0 ? "Processed" : "Ready");
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
          count={index === 0 ? uploadedCount : metric.count}
          status={index === 0 ? uploadedStatus : metric.status}
          icon={metric.icon as IconName}
          accent={metric.accent}
        />
      ))}
    </section>
  );
}
