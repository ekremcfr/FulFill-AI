import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WarehouseMap } from "@/components/warehouse-map";

export const Route = createFileRoute("/slotting")({
  head: () => ({
    meta: [
      { title: "Smart Slotting · FulfillAI" },
      { name: "description", content: "AI-driven product placement recommendations." },
    ],
  }),
  component: SlottingPage,
});

const RESLOT = [
  { sku: "SKU-K7B", name: "Nitrile Gloves L (case)", from: "K-B7", to: "B-T3", zone: "C→A", picks: 412, save: "$18.4K/yr", delta: 92 },
  { sku: "SKU-J2A", name: "Bubble mailer 6×9", from: "J-T2", to: "A-T4", zone: "C→A", picks: 388, save: "$16.1K/yr", delta: 88 },
  { sku: "SKU-H3A", name: "USB-C cable 2m", from: "H-T3", to: "B-B1", zone: "B→A", picks: 274, save: "$11.7K/yr", delta: 71 },
  { sku: "SKU-F1A", name: "Thermal receipt roll", from: "F-T1", to: "A-B6", zone: "B→A", picks: 231, save: "$9.8K/yr", delta: 64 },
  { sku: "SKU-L4B", name: "Void fill (5 cuft)", from: "L-B4", to: "C-T2", zone: "C→B", picks: 198, save: "$7.2K/yr", delta: 54 },
];

function SlottingPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-5">
        <section className="card-surface relative flex min-h-[520px] flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Cycle 2026-Q3 · 14,208 SKUs analyzed</p>
              <h1 className="mt-0.5 font-display text-2xl text-foreground">Smart Slotting</h1>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground">Baseline: current layout</span>
              <button className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90">Simulate reslot</button>
            </div>
          </div>
          <div className="grid-bg relative flex-1 overflow-hidden">
            <WarehouseMap className="h-full w-full" showRoute={false} highlightAisles={["A", "B", "H", "K", "J", "F"]} />
            <div className="absolute bottom-4 right-4 rounded-xl border border-border bg-surface/95 p-4 text-[12px] shadow-lg backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Projected impact</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl text-foreground">$184K</span>
                <span className="text-emerald-600">annualized savings</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-[11px]">
                <div><div className="text-muted-foreground">Travel</div><div className="font-mono text-foreground">−31%</div></div>
                <div><div className="text-muted-foreground">Congestion</div><div className="font-mono text-foreground">−18%</div></div>
                <div><div className="text-muted-foreground">Pick rate</div><div className="font-mono text-emerald-600">+22%</div></div>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[420px]">
          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Slotting model</h2>
            <div className="mt-3 space-y-2 text-[12px]">
              {[
                ["Signals", "Velocity · affinity · seasonality"],
                ["Horizon", "90-day forward demand"],
                ["Ergonomics", "Golden-zone weighted"],
                ["Confidence", "94.2%"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/60 pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Recommended moves</h2>
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">124 total</span>
            </div>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {RESLOT.map((r) => (
                <li key={r.sku} className="p-3 transition hover:bg-surface-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-foreground">{r.sku}</span>
                        <span className="rounded bg-primary-soft px-1 py-px text-[10px] font-semibold text-primary">{r.zone}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{r.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-emerald-600">{r.save}</div>
                      <div className="text-[10px] text-muted-foreground">{r.picks}×/day</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{r.from}</span>
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    <span className="font-mono text-foreground">{r.to}</span>
                    <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${r.delta}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <button className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                Approve top 5 moves
              </button>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
