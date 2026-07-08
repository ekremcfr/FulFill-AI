import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  IsometricWarehouse,
  type OptPhase,
  type _RackData as RackData,
} from "@/components/isometric-warehouse";
import { setSelectedShelf } from "@/lib/copilot-context";
import { LiveInsightsFeed } from "@/components/live-insights-feed";
import { ShelfAiAnalysis } from "@/components/shelf-ai-analysis";
import { ProactiveInsightPanel } from "@/components/proactive-insight-panel";
import type { MapSelection } from "@/lib/map-selection";
import { PICK_TASKS } from "@/lib/warehouse-data";
import { emitOptimizationComplete } from "@/lib/optimization-events";



export const Route = createFileRoute("/")({
  component: WarehousePage,
});

interface OptState {
  phase: OptPhase;
  message: string;
  messageIndex: number;
}

function WarehousePage() {
  const [selected, setSelected] = useState<RackData | null>(null);
  const [optimizeNonce, setOptimizeNonce] = useState(0);
  const [opt, setOpt] = useState<OptState>({ phase: "idle", message: "", messageIndex: -1 });
  const [optimized, setOptimized] = useState(false);
  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);

  useEffect(() => {
    setSelectedShelf(selected ? `${selected.id} (SKU ${selected.sku})` : null);
    if (selected) setMapSelection({ kind: "shelf", rack: selected });
  }, [selected]);


  const triggerOptimize = () => {
    setSelected(null);
    setMapSelection(null);
    setOptimized(false);
    setOptimizeNonce((n) => n + 1);
  };


  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-5">
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
            <button
              onClick={triggerOptimize}
              disabled={opt.phase !== "idle" && opt.phase !== "done"}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_24px_-8px_rgba(16,185,129,0.55)] transition hover:from-emerald-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
                </svg>
                {opt.phase === "idle" || opt.phase === "done"
                  ? "Optimize Warehouse"
                  : "Optimizing…"}
              </span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/25 group-hover:translate-x-full transition-transform duration-700" />
            </button>
          </div>

          <div className="relative flex-1">
            <IsometricWarehouse
              className="absolute inset-0 h-full w-full"
              onSelectRack={setSelected}
              onSelectZone={(z) => setMapSelection({ kind: "zone", zone: z })}
              onSelectWorker={(id) => setMapSelection({ kind: "worker", workerId: id })}
              onSelectRoute={(label) => setMapSelection({ kind: "route", label })}
              optimizeNonce={optimizeNonce}
              onOptimizePhase={(phase) => setOpt((p) => ({ ...p, phase }))}
              onOptimizeMessage={(message, messageIndex) =>
                setOpt((p) => ({ ...p, message, messageIndex }))
              }
              onOptimizeComplete={() => setOptimized(true)}
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

            {/* Proactive contextual AI insight panel */}
            <ProactiveInsightPanel
              selection={mapSelection}
              onClose={() => {
                setMapSelection(null);
                setSelected(null);
              }}
            />

            {/* Live orders strip — clicking an order triggers proactive AI */}
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
              <span className="pl-1.5 pr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Live orders
              </span>
              {PICK_TASKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    setMapSelection({
                      kind: "order",
                      orderId: t.order,
                      sku: t.sku,
                      aisle: t.aisle,
                      qty: t.qty,
                    })
                  }
                  className="rounded-full border border-border bg-surface-muted/60 px-2 py-0.5 font-mono text-[10px] text-foreground transition hover:border-emerald-400 hover:bg-emerald-50"
                  title={`${t.sku} · Aisle ${t.aisle} · qty ${t.qty}`}
                >
                  {t.order}
                </button>
              ))}
            </div>

            {/* AI cinematic panel */}
            <AIOptimizerPanel opt={opt} />
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
          {selected ? (
            <SelectedRack rack={selected} onClose={() => setSelected(null)} />
          ) : (
            <KpiStack optimized={optimized} phase={opt.phase} />
          )}
          <LiveInsightsFeed />
        </aside>
      </div>
    </AppShell>
  );
}

/* ============================================================
 * AI Optimizer floating panel
 * ==========================================================*/
function AIOptimizerPanel({ opt }: { opt: OptState }) {
  const active = opt.phase !== "idle";
  const progress =
    opt.phase === "dim" ? 0.02 :
    opt.phase === "scan" ? 0.25 :
    opt.phase === "route" ? 0.55 :
    opt.phase === "walk" ? 0.85 :
    opt.phase === "done" ? 1 : 0;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-6 z-30 w-[min(520px,calc(100%-3rem))] -translate-x-1/2 transition-all duration-500 ${
        active ? "opacity-100 translate-y-0" : "-translate-y-6 opacity-0"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-[#050914]/92 p-4 text-white shadow-[0_20px_80px_-20px_rgba(16,185,129,0.5)] backdrop-blur-xl">
        {/* animated gradient border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-70">
          <div className="absolute inset-[1px] rounded-2xl bg-[#050914]/95" />
          <div
            className="absolute -inset-8 opacity-30"
            style={{
              background:
                "conic-gradient(from 0deg, #22C55E, #10B981, #06B6D4, #22C55E)",
              animation: "opt-spin 4s linear infinite",
            }}
          />
        </div>

        <div className="relative flex items-start gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-300" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
            {opt.phase !== "done" && (
              <span className="absolute inset-0 rounded-xl border border-emerald-400/60 animate-ping" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              FulfillAI · optimizer
              <span className="ml-auto font-mono text-[10px] text-white/50">
                {opt.phase === "done" ? "READY" : phaseLabel(opt.phase)}
              </span>
            </div>
            <div className="mt-1 min-h-[22px] text-[14px] font-medium leading-snug text-white">
              <AnimatedText text={opt.message || "Warming up neural planner…"} />
            </div>

            {/* progress bar */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-white/50">
              <span>{phaseCaption(opt.phase)}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes opt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AnimatedText({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  const prev = useRef(text);
  useEffect(() => {
    if (text === prev.current) return;
    prev.current = text;
    setDisplay(text);
  }, [text]);
  return (
    <span key={display} className="inline-block animate-[fade-in_.35s_ease-out]">
      {display}
    </span>
  );
}

function phaseLabel(p: OptPhase) {
  switch (p) {
    case "idle": return "IDLE";
    case "dim": return "INIT";
    case "scan": return "SCAN";
    case "route": return "PLAN";
    case "walk": return "EXEC";
    case "done": return "DONE";
  }
}
function phaseCaption(p: OptPhase) {
  switch (p) {
    case "idle": return "Awaiting input";
    case "dim": return "Preparing model";
    case "scan": return "Scanning warehouse";
    case "route": return "Building route";
    case "walk": return "Simulating pick tour";
    case "done": return "Optimization complete";
  }
}

/* ============================================================
 * Animated KPI stack
 * ==========================================================*/
interface KpiDef {
  label: string;
  from: number;
  to: number;
  unit: string;
  format: (v: number) => string;
  deltaBaseline?: string;
  deltaOptimized: string;
}

const KPIS_ANIM: KpiDef[] = [
  {
    label: "Distance",
    from: 17.8,
    to: 11.9,
    unit: "km",
    format: (v) => v.toFixed(1),
    deltaBaseline: "Baseline",
    deltaOptimized: "−33%",
  },
  {
    label: "Pick time",
    from: 91,
    to: 58,
    unit: "min",
    format: (v) => Math.round(v).toString(),
    deltaBaseline: "Baseline",
    deltaOptimized: "−36%",
  },
  {
    label: "Labor cost",
    from: 2.18,
    to: 1.66,
    unit: "$ / order",
    format: (v) => `$${v.toFixed(2)}`,
    deltaBaseline: "Baseline",
    deltaOptimized: "−24%",
  },
  {
    label: "Pick rate",
    from: 96,
    to: 142,
    unit: "/ hr",
    format: (v) => Math.round(v).toString(),
    deltaBaseline: "Baseline",
    deltaOptimized: "+48%",
  },
];

function KpiStack({ optimized, phase }: { optimized: boolean; phase: OptPhase }) {
  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Optimization impact</h2>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
            optimized
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {optimized ? "Optimized" : "Baseline"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {KPIS_ANIM.map((k) => (
          <KpiCard key={k.label} def={k} optimized={optimized} phase={phase} />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {optimized
          ? "Route deployed to floor · 12 pickers rebriefed"
          : "Click Optimize Warehouse to run the AI planner"}
      </p>
    </div>
  );
}

function KpiCard({ def, optimized, phase }: { def: KpiDef; optimized: boolean; phase: OptPhase }) {
  const target = optimized ? def.to : def.from;
  const value = useAnimatedNumber(target, 1200);
  const improved = optimized;
  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-3 transition-colors ${
        improved
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-border bg-surface-muted/40"
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{def.label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-2xl text-foreground tabular-nums">
          {def.format(value)}
        </span>
        <span className="text-[11px] text-muted-foreground">{def.unit}</span>
      </div>
      <div
        className={`mt-1 text-[11px] font-medium ${
          improved ? "text-emerald-600" : "text-muted-foreground"
        }`}
      >
        {improved ? def.deltaOptimized : def.deltaBaseline}
      </div>
      {phase === "walk" && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] animate-pulse bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      )}
    </div>
  );
}

function useAnimatedNumber(target: number, durMs: number) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    fromRef.current = val;
    startRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

/* ============================================================
 * Selected rack + insights (unchanged from base)
 * ==========================================================*/
function SelectedRack({ rack, onClose }: { rack: RackData; onClose: () => void }) {
  const pct = Math.round((rack.inventory / rack.capacity) * 100);
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-primary/[0.03] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-foreground">{rack.id}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                rack.zone === "A"
                  ? "bg-amber-100 text-amber-800"
                  : rack.zone === "B"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              Zone {rack.zone}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Aisle {rack.aisle} · Row {rack.row} · Slot {rack.slot + 1}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <div className="text-sm font-medium text-foreground">{rack.productName}</div>
        <div className="font-mono text-[11px] text-muted-foreground">SKU {rack.sku}</div>

        <div className="mt-4 space-y-3 text-[12px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inventory</span>
              <span className="font-mono text-foreground">
                {rack.inventory} / {rack.capacity}{" "}
                <span className="text-muted-foreground">({pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <StatCell
              label="Demand"
              value={rack.demand}
              accent={
                rack.demand === "High"
                  ? "text-red-600"
                  : rack.demand === "Medium"
                    ? "text-amber-600"
                    : "text-slate-500"
              }
            />
            <StatCell label="Picks/day" value={String(rack.freq)} />
            <StatCell label="Avg daily" value={String(rack.avgDaily)} />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-primary/20 bg-primary-soft/60 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
            AI Recommendation
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">{rack.rec}</div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90">
              Simulate move
            </button>
            <button className="rounded-md border border-border px-2 py-1.5 text-[11px] text-foreground/80 hover:bg-surface-muted">
              Dismiss
            </button>
          </div>
        </div>
      </div>
      <ShelfAiAnalysis rack={rack} />
    </div>
  );
}


function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold ${accent ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

