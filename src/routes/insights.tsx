import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { INSIGHTS, KPIS } from "@/lib/warehouse-data";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights · FulfillAI" },
      { name: "description", content: "Live warehouse decision intelligence streaming from the floor." },
    ],
  }),
  component: InsightsPage,
});

const STREAM = [
  { t: "14:22:04", type: "SLOT", msg: "SKU-K7B flagged for reslot — 3σ above dwell threshold" },
  { t: "14:21:47", type: "ROUTE", msg: "Wave 3 re-optimized · 42 min (−16 min)" },
  { t: "14:21:12", type: "FLOW", msg: "Aisle F congestion forecast: peak in 38 min" },
  { t: "14:20:58", type: "SLOT", msg: "Affinity cluster detected: SKU-A2B + SKU-C5A (0.87)" },
  { t: "14:20:31", type: "CAPEX", msg: "AS/RS payback recomputed: 6.8 → 7.1 yrs" },
  { t: "14:19:54", type: "ROUTE", msg: "Picker P-024 rerouted around dock congestion" },
  { t: "14:19:12", type: "FLOW", msg: "Wave 4 preview: 61 orders · projected 38 min" },
];

function InsightsPage() {
  return (
    <AppShell>
      <div className="grid gap-4 p-4 lg:grid-cols-3 lg:p-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Live intelligence</p>
                <h1 className="mt-1 font-display text-3xl text-foreground">AI Insights</h1>
                <p className="mt-1 text-sm text-muted-foreground">Every 12 seconds the decision engine ingests floor telemetry and surfaces high-leverage moves.</p>
              </div>
              <div className="text-right">
                <div className="font-display text-4xl text-foreground">$2.4M</div>
                <div className="text-[11px] text-muted-foreground">capex deferred YTD</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-surface-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                  <div className="mt-1 font-display text-xl text-foreground">{k.value}<span className="text-[11px] text-muted-foreground"> {k.unit}</span></div>
                  <div className="text-[11px] font-medium text-emerald-600">{k.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Prioritized decisions</h2>
              <div className="flex gap-1 text-[11px]">
                {["All", "Slotting", "Routing", "Flow", "Capex"].map((f, i) => (
                  <button key={f} className={`rounded-md px-2 py-1 ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-border">
              {INSIGHTS.map((it) => (
                <li key={it.id} className="flex items-start gap-4 p-5 transition hover:bg-surface-muted/40">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">{it.title}</h3>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        it.severity === "opportunity" ? "bg-emerald-50 text-emerald-700" :
                        it.severity === "warning" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{it.impact}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{it.detail}</p>
                    <div className="mt-3 flex gap-2">
                      <button className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90">Simulate</button>
                      <button className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-surface-muted">Assign</button>
                      <button className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Snooze</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="card-surface flex min-h-[600px] flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <h2 className="text-sm font-semibold text-foreground">Decision stream</h2>
            </div>
            <p className="text-[11px] text-muted-foreground">Real-time model output</p>
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto p-3 font-mono text-[11px]">
            {STREAM.map((e, i) => (
              <li key={i} className="flex gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted">
                <span className="text-muted-foreground">{e.t}</span>
                <span className={`w-14 shrink-0 font-semibold ${
                  e.type === "SLOT" ? "text-primary" :
                  e.type === "ROUTE" ? "text-emerald-600" :
                  e.type === "FLOW" ? "text-amber-600" :
                  "text-slate-500"
                }`}>{e.type}</span>
                <span className="text-foreground/80">{e.msg}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
