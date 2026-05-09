import { ArrowRight, Layers3, Sparkles } from "lucide-react";

type PlaceholderPageProps = {
  title: string;
  description: string;
  phase: string;
  previews: readonly string[];
};

export function PlaceholderPage({ title, description, phase, previews }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-6 shadow-panel-glow">
        <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/15 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          {phase}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-text">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-secondary">{description}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {previews.map((preview, index) => (
          <article key={preview} className="rounded-2xl border border-brand-border bg-brand-card/70 p-5 shadow-panel-glow">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-[#7AA7FF]">
                {index === 0 ? <Layers3 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
              </span>
              <div>
                <h2 className="text-base font-semibold text-brand-text">
                  {index === 0 ? "Workspace Preview" : "Phase 2 Capability"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-brand-secondary">{preview}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-brand-border bg-brand-panel/75 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-text">ETL.qaplanet.ca baseline</h2>
            <p className="mt-1 text-sm text-brand-secondary">
              This route is wired into the Phase 1 shell and ready for backend, upload, and AI workflows.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-teal">
            Ready for expansion <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </section>
    </div>
  );
}
