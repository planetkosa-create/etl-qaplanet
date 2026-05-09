import { Bell, ChevronDown, CircleHelp, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-border bg-brand-background/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          aria-label="Search workspace"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-white">
            8
          </span>
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-secondary transition hover:bg-brand-card hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          aria-label="Help"
        >
          <CircleHelp className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ml-1 flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-card/70 px-3 py-2 text-left transition hover:border-brand-primary/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
          aria-label="Open user menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-electric to-brand-teal text-sm font-bold text-white">
            OK
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold text-brand-text">Othaim Kosa</span>
            <span className="block text-xs text-brand-secondary">QA Manager</span>
          </span>
          <ChevronDown className="h-4 w-4 text-brand-secondary" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
