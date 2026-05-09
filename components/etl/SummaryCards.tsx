type SummaryCardsProps = {
  items: Array<{
    label: string;
    value: number | string;
    accent?: "blue" | "teal" | "green" | "orange" | "red";
  }>;
};

const accents = {
  blue: "text-[#7AA7FF]",
  teal: "text-brand-teal",
  green: "text-brand-success",
  orange: "text-brand-warning",
  red: "text-brand-danger",
};

export function SummaryCards({ items }: SummaryCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => (
        <article key={item.label} className="rounded-2xl border border-brand-border bg-brand-card/70 p-4 shadow-panel-glow">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{item.label}</p>
          <p className={`mt-3 text-3xl font-bold ${accents[item.accent ?? "blue"]}`}>{item.value}</p>
        </article>
      ))}
    </section>
  );
}
