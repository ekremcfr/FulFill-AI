import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WarehouseMap } from "@/components/warehouse-map";
import { PICK_TASKS } from "@/lib/warehouse-data";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Route Optimization · FulfillAI" },
      { name: "description", content: "AI-optimized picking routes that cut travel by 26%." },
    ],
  }),
  component: RoutesPage,
});

function RoutesPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-5">
        <section className="card-surface relative flex min-h-[520px] flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Wave 3 · 74 orders</p>
              <h1 className="mt-0.5 font-display text-2xl text-foreground">Route Optimizer</h1>
            </div>
            <div className="flex items-center gap-2">
              <StatChip label="Distance" value="0.34 mi" delta="−26%" />
              <StatChip label="Time" value="42 min" delta="−31%" />
              <StatChip label="Bins" value="118" />
            </div>
          </div>
          <div className="grid-bg relative flex-1 overflow-hidden">
            <WarehouseMap className="h-full w-full" />
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Algorithm</h2>
            <div className="mt-3 space-y-2 text-[12px]">
              {[
                ["Strategy", "S-shape → OR-Tools VRP"],
                ["Batching", "Affinity clustering (k=6)"],
                ["Constraints", "Pick-face reach · dwell time"],
                ["Reoptimize", "Every 90 s"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/60 pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Compare routes</h2>
            <div className="mt-3 space-y-3 text-[12px]">
              {[
                { name: "Naive S-shape", dist: "0.46 mi", time: "58 min", color: "bg-slate-300" },
                { name: "Return path", dist: "0.41 mi", time: "51 min", color: "bg-slate-500" },
                { name: "AI (VRP + affinity)", dist: "0.34 mi", time: "42 min", color: "bg-primary", active: true },
              ].map((r) => (
                <div key={r.name} className={`rounded-lg border p-3 ${r.active ? "border-primary/40 bg-primary-soft/40" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className={`h-2 w-2 rounded-full ${r.color}`} />
                      {r.name}
                    </span>
                    {r.active && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">SELECTED</span>}
                  </div>
                  <div className="mt-1 flex gap-4 text-muted-foreground">
                    <span>{r.dist}</span><span>{r.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Stops · 5 of 118</h2>
            </div>
            <ol className="flex-1 space-y-1 overflow-y-auto p-2 text-[12px]">
              {PICK_TASKS.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{i + 1}</span>
                  <span className="w-16 font-mono text-foreground">{t.bin}</span>
                  <span className="flex-1 truncate text-foreground/80">{t.sku}</span>
                  <span className="font-mono text-muted-foreground">{t.eta}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function StatChip({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
        {delta && <span className="text-[10px] font-medium text-emerald-600">{delta}</span>}
      </div>
    </div>
  );
}
