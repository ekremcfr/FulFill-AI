import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { REPORTS } from "@/lib/warehouse-data";
import { NewStudyModal, type GeneratedStudy } from "@/components/new-study-modal";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · FulfillAI" },
      { name: "description", content: "Executive-ready warehouse decision reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [studies, setStudies] = useState<GeneratedStudy[]>([]);
  const latest = studies[0];
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl p-5">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Board-ready</p>
            <h1 className="mt-1 font-display text-3xl text-foreground">Reports & Business KPIs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quarterly decision studies · exportable to PDF and Looker.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModalOpen(true)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground/80 hover:bg-surface-muted">New study</button>
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Export CSV</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[
            { label: "YTD savings", value: "$1.28M", delta: "+38% YoY" },
            { label: "Capex deferred", value: "$2.4M", delta: "AS/RS study" },
            { label: "Orders analyzed", value: "8.4M", delta: "rolling 90d" },
            { label: "Decisions/day", value: "3,412", delta: "94% adopted" },
          ].map((k) => (
            <div key={k.label} className="card-surface p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="mt-1 font-display text-3xl text-foreground">{k.value}</div>
              <div className="mt-1 text-[11px] text-emerald-600">{k.delta}</div>
            </div>
          ))}
        </div>

        <div className="card-surface mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent studies</h2>
            <div className="flex gap-1 text-[11px]">
              {["All", "Slotting", "Routing", "Simulation", "Capex"].map((f, i) => (
                <button key={f} className={`rounded-md px-2 py-1 ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-medium">Report</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Period</th>
                <th className="px-5 py-2 font-medium">Generated</th>
                <th className="px-5 py-2 text-right font-medium">Impact</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...studies, ...REPORTS].map((r) => (
                <tr key={r.id} className={`transition hover:bg-surface-muted/50 ${latest && r.id === latest.id ? "bg-primary-soft/40 animate-in fade-in slide-in-from-top-2" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" /><path d="M14 3v6h6" /></svg>
                      </span>
                      <span className="font-medium text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">{r.type}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.period}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.generated}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-600">{r.savings}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground/80 hover:bg-surface-muted">Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">Savings by initiative</h3>
            <div className="mt-4 space-y-3">
              {[
                { name: "Smart slotting", pct: 46, value: "$586K" },
                { name: "Route optimization", pct: 32, value: "$412K" },
                { name: "Wave balancing", pct: 14, value: "$178K" },
                { name: "Dock scheduling", pct: 8, value: "$104K" },
              ].map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-foreground/80">{s.name}</span>
                    <span className="font-mono font-medium text-foreground">{s.value}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card-surface p-5">
            <h3 className="text-sm font-semibold text-foreground">Automation ROI benchmark</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Payback horizon at current 12K orders/day.</p>
            <div className="mt-4 space-y-2 text-[13px]">
              {[
                { name: "AS/RS full deploy", years: "6.8 yrs", verdict: "Defer" },
                { name: "AMR fleet (24 units)", years: "3.2 yrs", verdict: "Pilot" },
                { name: "Put-wall reslot", years: "0.9 yrs", verdict: "Ship" },
                { name: "Voice picking", years: "1.4 yrs", verdict: "Ship" },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-foreground">{r.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground">{r.years}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      r.verdict === "Ship" ? "bg-emerald-50 text-emerald-700" :
                      r.verdict === "Pilot" ? "bg-amber-50 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>{r.verdict}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {latest && (
          <div className="mt-6 card-surface p-5 border-primary/40 animate-in fade-in slide-in-from-bottom-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-primary">Latest study · AI generated</p>
                <h3 className="mt-1 font-display text-xl text-foreground">{latest.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{latest.reportSummary}</p>
              </div>
              <span className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">Savings {latest.savings}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {latest.kpis.map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                  <div className="mt-1 font-display text-xl text-foreground">{k.value}</div>
                  <div className="mt-0.5 text-[11px] text-emerald-600">{k.delta}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">AI recommendations</p>
              <ul className="mt-2 space-y-2">
                {latest.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground">
                    <span className="text-primary">→</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <NewStudyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onComplete={(s) => setStudies((prev) => [s, ...prev])}
      />
    </AppShell>
  );
}
