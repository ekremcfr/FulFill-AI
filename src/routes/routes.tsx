import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { WarehouseMap } from "@/components/warehouse-map";
import { OPTIMIZED_ROUTE, PICK_TASKS } from "@/lib/warehouse-data";
import { askCopilot } from "@/lib/copilot.functions";

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Smart Picking · FulfillAI" },
      {
        name: "description",
        content:
          "Upload orders, run the FulfillAI optimization engine, and deploy AI-optimized picking routes that cut travel by 30%+.",
      },
    ],
  }),
  component: SmartPickingPage,
});

type Stage = "upload" | "validated" | "optimizing" | "results";

interface OrdersDataset {
  orders: number;
  skus: number;
  lines: number;
  workloadMin: number;
  source: "demo" | "csv";
  fileName?: string;
}

const DEMO_DATASET: OrdersDataset = {
  orders: 74,
  skus: 118,
  lines: 312,
  workloadMin: 91,
  source: "demo",
};

const AI_MESSAGES = [
  "Reading warehouse layout…",
  "Loading order history…",
  "Grouping nearby orders…",
  "Calculating shortest paths…",
  "Detecting congestion…",
  "Building optimal picking route…",
  "Optimization complete.",
];

function SmartPickingPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [dataset, setDataset] = useState<OrdersDataset | null>(null);
  const [aiMsgIndex, setAiMsgIndex] = useState(0);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const askCopilotFn = useServerFn(askCopilot);

  const handleDemo = () => {
    setDataset(DEMO_DATASET);
    setStage("validated");
  };

  const handleCsv = (file: File) => {
    // Simulated parse — the demo is deterministic
    const jitter = (file.size % 20) + 60;
    setDataset({
      orders: jitter,
      skus: Math.round(jitter * 1.5),
      lines: Math.round(jitter * 4.1),
      workloadMin: Math.round(jitter * 1.22),
      source: "csv",
      fileName: file.name,
    });
    setStage("validated");
  };

  const runOptimize = useCallback(async () => {
    setStage("optimizing");
    setAiMsgIndex(0);
    for (let i = 0; i < AI_MESSAGES.length; i++) {
      await new Promise((r) => setTimeout(r, i === AI_MESSAGES.length - 1 ? 700 : 850));
      setAiMsgIndex(i);
    }
    await new Promise((r) => setTimeout(r, 500));
    setStage("results");

    // Fire AI summary in the background
    if (dataset) {
      setAiLoading(true);
      setAiSummary("");
      const ctx = `LIVE WAREHOUSE CONTEXT — Smart Picking run:
- Orders: ${dataset.orders}
- SKUs: ${dataset.skus}
- Pick lines: ${dataset.lines}
- Baseline walking distance: 17.8 km
- Optimized walking distance: 11.9 km (−33%)
- Baseline pick time: ${dataset.workloadMin} min → 58 min (−36%)
- Labor cost: $2.18 → $1.66 per order (−24%)
- CO₂ reduction: ~4.2 kg per wave
- Batching: 12 batches of 5–7 orders using SKU-affinity clustering
- Route strategy: OR-Tools VRP with pick-face reach and dwell-time constraints
- Congestion: Aisle F 14:00 spike smoothed via 12 min stagger`;

      const prompt = `Explain to the warehouse manager why this optimized picking route was selected, what batching opportunities were exploited, and the expected business impact. Use the required 4-section format (Summary, Reasoning, Business Impact, Recommendation).`;

      try {
        const res = await askCopilotFn({
          data: {
            messages: [{ role: "user" as const, text: prompt }],
            contextText: ctx,
          },
        });
        if (res.ok) setAiSummary(res.text);
        else setAiSummary(`Copilot unavailable: ${res.error ?? res.statusText}`);
      } catch (err) {
        setAiSummary(err instanceof Error ? err.message : String(err));
      } finally {
        setAiLoading(false);
      }
    }
  }, [dataset, askCopilotFn]);

  const reset = () => {
    setStage("upload");
    setDataset(null);
    setAiSummary("");
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              FulfillAI · Smart Picking Engine
            </div>
            <h1 className="mt-1 font-display text-3xl leading-tight text-foreground">
              Smart Picking
            </h1>
          </div>
          <StageStepper stage={stage} />
        </header>

        <div className="relative min-h-0 flex-1">
          {stage === "upload" && (
            <UploadStage onDemo={handleDemo} onCsv={handleCsv} />
          )}
          {stage === "validated" && dataset && (
            <ValidateStage
              dataset={dataset}
              onOptimize={runOptimize}
              onBack={reset}
            />
          )}
          {stage === "results" && dataset && (
            <ResultsStage
              dataset={dataset}
              aiSummary={aiSummary}
              aiLoading={aiLoading}
              onReset={reset}
            />
          )}
        </div>
      </div>

      {stage === "optimizing" && <OptimizingOverlay msgIndex={aiMsgIndex} />}
    </AppShell>
  );
}

/* ============================================================
 * Stage 0 · Stepper
 * ==========================================================*/
function StageStepper({ stage }: { stage: Stage }) {
  const steps = [
    { id: "upload", label: "Upload" },
    { id: "validated", label: "Validate" },
    { id: "optimizing", label: "Optimize" },
    { id: "results", label: "Deploy" },
  ] as const;
  const activeIdx = steps.findIndex((s) => s.id === stage);
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1.5 text-[11px]">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-semibold transition ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`pr-1 ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="h-px w-4 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
 * Stage 1 · Upload
 * ==========================================================*/
function UploadStage({
  onDemo,
  onCsv,
}: {
  onDemo: () => void;
  onCsv: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onCsv(f);
  };

  return (
    <div className="animate-fade-in grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`card-surface relative flex flex-col items-center justify-center gap-4 overflow-hidden p-8 text-center transition ${
          drag ? "border-emerald-400 bg-emerald-50/50" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/30">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-emerald-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </div>
        <div className="relative">
          <h2 className="font-display text-xl text-foreground">
            Drop your orders CSV here
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            One row per order line · columns: order_id, sku, qty, priority
          </p>
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
          >
            Browse files
          </button>
          <span className="text-xs text-muted-foreground">or</span>
          <button
            onClick={onDemo}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55)] transition hover:brightness-110"
          >
            Use Demo Orders
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="relative mt-2 text-[11px] text-muted-foreground">
          Max 50k lines · encrypted in transit
        </p>
      </div>

      <aside className="card-surface flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">How it works</h3>
        {[
          ["1", "Upload orders", "Drag a CSV or use the demo dataset."],
          ["2", "AI validates", "Line counts, SKU coverage, workload."],
          ["3", "Optimizer runs", "Batching + VRP + congestion model."],
          ["4", "Deploy to floor", "Animated route ready for pickers."],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary">
              {n}
            </span>
            <div className="text-[12px] leading-snug">
              <div className="font-medium text-foreground">{t}</div>
              <div className="text-muted-foreground">{d}</div>
            </div>
          </div>
        ))}
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-[11px] text-emerald-800">
          <span className="font-semibold">Tip:</span> The demo dataset mirrors a
          typical wave — 74 orders across 12 aisles.
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
 * Stage 2 · Validate
 * ==========================================================*/
function ValidateStage({
  dataset,
  onOptimize,
  onBack,
}: {
  dataset: OrdersDataset;
  onOptimize: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-fade-in grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card-surface flex flex-col overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
            ✓ Orders validated
          </div>
          <h2 className="mt-0.5 font-display text-xl text-foreground">
            {dataset.source === "csv"
              ? dataset.fileName ?? "orders.csv"
              : "Demo wave — Reno DC-04"}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
          <ValidateStat label="Orders" value={dataset.orders.toString()} />
          <ValidateStat label="Unique SKUs" value={dataset.skus.toString()} />
          <ValidateStat label="Pick lines" value={dataset.lines.toString()} />
          <ValidateStat
            label="Est. workload"
            value={`${dataset.workloadMin} min`}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sample lines
          </div>
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-2 text-left">Order</th>
                <th className="pb-2 text-left">SKU</th>
                <th className="pb-2 text-left">Aisle</th>
                <th className="pb-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {PICK_TASKS.map((t) => (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="py-1.5 text-foreground">{t.order}</td>
                  <td className="py-1.5 text-foreground">{t.sku}</td>
                  <td className="py-1.5 text-muted-foreground">{t.aisle}</td>
                  <td className="py-1.5 text-right text-foreground">{t.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            onClick={onBack}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            ← Change dataset
          </button>
          <button
            onClick={onOptimize}
            className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] transition hover:brightness-110"
          >
            <span className="relative z-10 flex items-center gap-2">
              <SparkleIcon />
              Optimize with AI
            </span>
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" />
          </button>
        </div>
      </div>

      <aside className="card-surface flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">Validation checks</h3>
        {[
          ["Schema", "All required columns present"],
          ["SKU coverage", "100% mapped to warehouse bins"],
          ["Priority mix", "12% expedite · 88% standard"],
          ["Feasibility", "Fits within a single shift"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-[12px]"
          >
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              ✓
            </span>
            <div>
              <div className="font-medium text-foreground">{k}</div>
              <div className="text-muted-foreground">{v}</div>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

function ValidateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
 * Stage 3 · Optimizing overlay (fullscreen)
 * ==========================================================*/
function OptimizingOverlay({ msgIndex }: { msgIndex: number }) {
  const progress = ((msgIndex + 1) / AI_MESSAGES.length) * 100;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04070f]/95 backdrop-blur-xl animate-fade-in">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.20), transparent 45%), radial-gradient(circle at 70% 70%, rgba(6,182,212,0.18), transparent 50%)",
          }}
        />
      </div>

      <div className="relative flex w-[min(560px,90vw)] flex-col items-center text-center text-white">
        {/* orbiting core */}
        <div className="relative mb-6 h-32 w-32">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #22C55E, #10B981, #06B6D4, #22C55E)",
              animation: "opt-spin 3s linear infinite",
            }}
          />
          <div className="absolute inset-[3px] rounded-full bg-[#04070f]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-emerald-300"
              fill="currentColor"
            >
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
          </div>
          <span className="absolute -inset-4 rounded-full border border-emerald-400/30 animate-ping" />
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300">
          FulfillAI Optimizer
        </div>
        <h2 className="mt-2 font-display text-2xl">Running AI optimization</h2>

        {/* Messages log */}
        <div className="mt-6 w-full space-y-1.5 text-left font-mono text-[13px]">
          {AI_MESSAGES.map((m, i) => {
            const done = i < msgIndex;
            const current = i === msgIndex;
            const future = i > msgIndex;
            return (
              <div
                key={m}
                className={`flex items-center gap-2.5 transition ${
                  future ? "opacity-25" : "opacity-100"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400"
                        : "bg-white/10 text-white/40"
                  }`}
                >
                  {done ? "✓" : current ? "…" : ""}
                </span>
                <span
                  className={
                    current
                      ? "text-white"
                      : done
                        ? "text-white/70"
                        : "text-white/50"
                  }
                >
                  {m}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 font-mono text-[10px] text-white/50">
          {Math.round(progress)}% · neural planner
        </div>
      </div>

      <style>{`@keyframes opt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ============================================================
 * Stage 4 · Results + Map + AI Summary
 * ==========================================================*/
function ResultsStage({
  dataset,
  aiSummary,
  aiLoading,
  onReset,
}: {
  dataset: OrdersDataset;
  aiSummary: string;
  aiLoading: boolean;
  onReset: () => void;
}) {
  const kpis = [
    { label: "Current walking", value: "17.8", unit: "km" },
    { label: "Optimized walking", value: "11.9", unit: "km", positive: true },
    { label: "Distance reduction", value: "−33", unit: "%", positive: true },
    { label: "Time saved", value: "33", unit: "min", positive: true },
    { label: "Labor cost saved", value: "$186", unit: "/ wave", positive: true },
    { label: "CO₂ reduction", value: "4.2", unit: "kg", positive: true },
  ];

  return (
    <div className="animate-fade-in grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      {/* Map + KPI strip */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`rounded-xl border p-3 ${
                k.positive
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-border bg-surface-muted/40"
              }`}
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span
                  className={`font-display text-xl tabular-nums ${
                    k.positive ? "text-emerald-700" : "text-foreground"
                  }`}
                >
                  {k.value}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {k.unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        <section className="card-surface relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Optimized picking route
              </div>
              <div className="mt-0.5 font-display text-lg text-foreground">
                Wave · {dataset.orders} orders · {dataset.lines} lines
              </div>
            </div>
            <button
              onClick={onReset}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-foreground hover:bg-surface-muted"
            >
              Run another wave
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden bg-surface-muted/30">
            <WarehouseMap className="h-full w-full" />
            <AnimatedPicker />
          </div>
        </section>
      </div>

      {/* AI summary */}
      <aside className="card-surface flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-emerald-600"
              fill="currentColor"
            >
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
              FulfillAI Copilot
            </div>
            <div className="text-[13px] font-semibold text-foreground">
              AI route rationale
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[13px] leading-relaxed text-foreground">
          {aiLoading && !aiSummary ? (
            <SummarySkeleton />
          ) : aiSummary ? (
            <FormattedSummary text={aiSummary} />
          ) : (
            <p className="text-muted-foreground">Awaiting AI analysis…</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      {[80, 60, 90, 70].map((w, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
          <div
            className="h-2 animate-pulse rounded bg-surface-muted"
            style={{ width: `${w}%` }}
          />
          <div
            className="h-2 animate-pulse rounded bg-surface-muted"
            style={{ width: `${w - 15}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function FormattedSummary({ text }: { text: string }) {
  // Split by section headers (Summary / Reasoning / Business Impact / Recommendation)
  const parts = text
    .split(/^\s*(?:\*\*)?(?:\d+\.\s*)?(Summary|Reasoning|Business Impact|Recommendation)(?:\*\*)?\s*[:\-–]?\s*$/im)
    .filter(Boolean);
  // If splitting didn't work, just render raw
  if (parts.length < 3) {
    return <p className="whitespace-pre-wrap text-foreground/90">{text}</p>;
  }
  const sections: Array<{ title: string; body: string }> = [];
  for (let i = 0; i < parts.length; i++) {
    if (/^(Summary|Reasoning|Business Impact|Recommendation)$/i.test(parts[i])) {
      sections.push({ title: parts[i], body: (parts[i + 1] ?? "").trim() });
      i++;
    }
  }
  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.title} className="animate-fade-in">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
            {s.title}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-foreground/90">
            {s.body.replace(/^\*\*|\*\*$/g, "")}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 * Animated picker following OPTIMIZED_ROUTE
 * ==========================================================*/
function AnimatedPicker() {
  const routeStr =
    "M " + OPTIMIZED_ROUTE.map(([x, y]) => `${x} ${y}`).join(" L ");

  return (
    <svg
      viewBox="0 0 1200 760"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <path id="opt-path" d={routeStr} />
      </defs>
      {/* Highlighted destination pings */}
      {OPTIMIZED_ROUTE.slice(1, -1).map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r="14"
            fill="none"
            stroke="oklch(0.65 0.18 155)"
            strokeWidth="1.5"
            opacity="0.6"
          >
            <animate
              attributeName="r"
              values="6;18;6"
              dur="2.2s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0;0.9"
              dur="2.2s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
      {/* Worker */}
      <g>
        <circle r="18" fill="oklch(0.65 0.18 155 / 0.25)">
          <animateMotion dur="14s" repeatCount="indefinite">
            <mpath href="#opt-path" />
          </animateMotion>
        </circle>
        <circle r="10" fill="oklch(0.65 0.18 155)" stroke="white" strokeWidth="2.5">
          <animateMotion dur="14s" repeatCount="indefinite">
            <mpath href="#opt-path" />
          </animateMotion>
        </circle>
      </g>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
    </svg>
  );
}
