import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { IsometricWarehouse, type _RackData as RackData } from "@/components/isometric-warehouse";
import { INSIGHTS, KPIS } from "@/lib/warehouse-data";

export const Route = createFileRoute("/")({
  component: WarehousePage,
});

function WarehousePage() {
  const [selected, setSelected] = useState<RackData | null>(null);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-5">
        {/* Warehouse digital twin — the product */}
        <section className="card-surface relative flex min-h-[520px] flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Digital twin · live telemetry · 2s cadence
              </div>
              <h1 className="mt-0.5 font-display text-2xl leading-tight text-foreground">
                Reno DC-04 <span className="text-muted-foreground">/ Floor 1</span>
              </h1>
            </div>
            <div className="hidden items-center gap-1 rounded-lg border border-border bg-surface p-0.5 md:flex">
              {["Operations", "Simulate", "History"].map((t, i) => (
                <button
                  key={t}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    i === 0 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1">
            <IsometricWarehouse
              className="absolute inset-0 h-full w-full"
              onSelectRack={setSelected}
            />
            {/* Ambient activity indicator */}
            <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1 rounded-xl border border-border bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-foreground">84 pickers · 6 forklifts</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span>Wave 3 / 74 orders</span>
                <span>ETA 42:11</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/40 px-5 py-2.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span><span className="font-mono text-foreground">412k</span> sqft</span>
              <span><span className="font-mono text-foreground">70</span> racks</span>
              <span><span className="font-mono text-foreground">2,410</span> bins</span>
              <span><span className="font-mono text-foreground">14,208</span> SKUs</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span>drag to pan · scroll to zoom · rotate slider</span>
            </div>
          </div>
        </section>

        {/* Side rail */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
          {selected ? <SelectedRack rack={selected} onClose={() => setSelected(null)} /> : <KpiStack />}
          <InsightsFeed />
        </aside>
      </div>
    </AppShell>
  );
}

function KpiStack() {
  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Today's KPIs</h2>
        <span className="text-[11px] text-muted-foreground">vs. baseline</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface-muted/40 p-3">
            <div className="text-[11px] text-muted-foreground">{k.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-2xl text-foreground">{k.value}</span>
              <span className="text-[11px] text-muted-foreground">{k.unit}</span>
            </div>
            <div className={`mt-1 text-[11px] font-medium ${k.positive ? "text-emerald-600" : "text-red-600"}`}>
              {k.delta}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Click any shelf to inspect
      </p>
    </div>
  );
}

function SelectedRack({ rack, onClose }: { rack: RackData; onClose: () => void }) {
  const pct = Math.round((rack.inventory / rack.capacity) * 100);
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-primary/[0.03] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-foreground">{rack.id}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              rack.zone === "A" ? "bg-amber-100 text-amber-800" :
              rack.zone === "B" ? "bg-blue-100 text-blue-800" :
              "bg-slate-100 text-slate-700"
            }`}>Zone {rack.zone}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Aisle {rack.aisle} · Row {rack.row} · Slot {rack.slot + 1}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="p-4">
        <div className="text-sm font-medium text-foreground">{rack.productName}</div>
        <div className="font-mono text-[11px] text-muted-foreground">SKU {rack.sku}</div>

        <div className="mt-4 space-y-3 text-[12px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inventory</span>
              <span className="font-mono text-foreground">{rack.inventory} / {rack.capacity} <span className="text-muted-foreground">({pct}%)</span></span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <StatCell label="Demand" value={rack.demand} accent={rack.demand === "High" ? "text-red-600" : rack.demand === "Medium" ? "text-amber-600" : "text-slate-500"} />
            <StatCell label="Picks/day" value={String(rack.freq)} />
            <StatCell label="Avg daily" value={String(rack.avgDaily)} />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-primary/20 bg-primary-soft/60 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" /></svg>
            AI Recommendation
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">{rack.rec}</div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90">Simulate move</button>
            <button className="rounded-md border border-border px-2 py-1.5 text-[11px] text-foreground/80 hover:bg-surface-muted">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function InsightsFeed() {
  return (
    <div className="card-surface flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary-soft">
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-primary" fill="currentColor">
                <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold text-foreground">AI Insights</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">4 new · updated 12s ago</p>
        </div>
        <button className="text-[11px] font-medium text-primary hover:underline">View all</button>
      </div>
      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {INSIGHTS.map((it) => (
          <li key={it.id} className="p-4 transition hover:bg-surface-muted/50">
            <div className="flex items-start gap-2.5">
              <SeverityDot severity={it.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug text-foreground">{it.title}</p>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    it.severity === "opportunity" ? "bg-emerald-50 text-emerald-700" :
                    it.severity === "warning" ? "bg-amber-50 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>{it.impact}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{it.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeverityDot({ severity }: { severity: "opportunity" | "warning" | "info" }) {
  const map = { opportunity: "bg-emerald-500", warning: "bg-amber-500", info: "bg-slate-400" };
  return (
    <span className="relative mt-1 flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${map[severity]}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${map[severity]}`} />
    </span>
  );
}
