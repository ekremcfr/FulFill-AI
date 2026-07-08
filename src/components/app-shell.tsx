import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { ExportModal } from "@/components/export-modal";

const NAV = [
  { to: "/", label: "Warehouse", icon: WarehouseIcon },
  { to: "/routes", label: "Smart Picking", icon: RouteIcon },
  { to: "/slotting", label: "Smart Slotting", icon: SlotIcon },
  { to: "/insights", label: "AI Insights", icon: SparkIcon },
  { to: "/reports", label: "Reports", icon: ReportIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 10l9-6 9 6v10a1 1 0 01-1 1h-4v-7h-8v7H4a1 1 0 01-1-1V10z" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">FulfillAI</div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-sidebar-muted">Decision Intel</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        <div className="px-2 pb-2 pt-3 text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-muted">
          Operations
        </div>
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-sidebar-muted group-hover:text-white"}`} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="px-2 pb-2 pt-6 text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-muted">
          Facility
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-sidebar-foreground/80">Reno DC-04</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <div className="mt-2 text-[11px] text-sidebar-muted">412K sqft · 84 pickers online</div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
            EM
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">Elena Marín</div>
            <div className="truncate text-[11px] text-sidebar-muted">VP Operations</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface/80 px-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden text-foreground/60 md:inline">Reno DC-04</span>
        <span className="hidden md:inline">/</span>
        <span className="font-medium text-foreground">Live Operations</span>
      </div>

      <div className="ml-4 hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground md:flex">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          placeholder="Search SKUs, orders, aisles…"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
        />
        <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground/80 transition hover:bg-surface-muted md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Wave 3 · 74 orders
        </button>
        <button className="hidden rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground/80 transition hover:bg-surface-muted sm:inline-block">
          Export
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          Run optimizer
        </button>
      </div>
    </header>
  );
}

function iconClass(className?: string) { return className ?? "h-4 w-4"; }
function WarehouseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l9-6 9 6v10H3V10z" /><path d="M9 21v-6h6v6" />
    </svg>
  );
}
function RouteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 000-8h-4a4 4 0 010-8h4" />
    </svg>
  );
}
function SlotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="15" width="7" height="6" rx="1" /><rect x="14" y="15" width="7" height="6" rx="1" />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
    </svg>
  );
}
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass(className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" /><path d="M14 3v6h6" />
    </svg>
  );
}
