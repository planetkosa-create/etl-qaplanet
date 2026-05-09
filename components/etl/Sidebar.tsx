"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CloudCog,
  Code2,
  Database,
  Download,
  FileText,
  Home,
  Network,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AssistantCard } from "@/components/etl/AssistantCard";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Requirements Upload", href: "/requirements-upload", icon: CloudCog },
  { label: "Mapping Analysis", href: "/mapping-analysis", icon: Network },
  { label: "Rule Extraction", href: "/rule-extraction", icon: FileText },
  { label: "SQL Validator Generator", href: "/sql-validator-generator", icon: Code2 },
  { label: "Oracle Checks", href: "/oracle-checks", icon: Database },
  { label: "Reconciliation Suite", href: "/reconciliation-suite", icon: Scale },
  { label: "Data Quality Checks", href: "/data-quality-checks", icon: ShieldCheck },
  { label: "Export Center", href: "/export-center", icon: Download },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-brand-border bg-brand-sidebar/95 px-5 py-5 lg:sticky lg:top-0 lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
        aria-label="ETL QAplanet dashboard"
      >
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-electric/15 text-brand-electric">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
          <Bot className="absolute -bottom-1 -right-1 h-4 w-4 text-brand-teal" aria-hidden="true" />
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-brand-text">
            ETL <span className="text-[#5EA1FF]">QAplanet</span>
          </div>
          <p className="text-xs text-brand-secondary">A QAplanet data validation product</p>
        </div>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal ${
                isActive
                  ? "bg-brand-primary text-white shadow-blue-glow"
                  : "text-brand-secondary hover:bg-brand-card hover:text-[#73A8FF]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <AssistantCard />
      </div>

      <footer className="mt-auto flex items-end justify-between pt-8 text-xs text-brand-secondary">
        <div className="space-y-2">
          <p>© 2024 QAplanet</p>
          <p>A PlanetKosa product</p>
        </div>
        <div className="flex items-center gap-3">
          <span>v1.0.0</span>
          <ShieldCheck className="h-5 w-5 text-brand-success" aria-hidden="true" />
        </div>
      </footer>
    </aside>
  );
}
