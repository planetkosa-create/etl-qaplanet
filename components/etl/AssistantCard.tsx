import { Bot, MessageCircle } from "lucide-react";

export function AssistantCard() {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-panel/70 p-4 shadow-panel-glow">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-electric/40 bg-brand-electric/15 text-brand-electric">
          <Bot className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-brand-text">ETL QA Assistant</h2>
          <p className="mt-2 text-xs leading-5 text-brand-secondary">
            Ask questions about your ETL, rules, mappings, validation scripts, etc.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-3 py-2.5 text-sm font-semibold text-white shadow-blue-glow transition hover:bg-brand-electric focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Chat with Assistant
      </button>
    </section>
  );
}
