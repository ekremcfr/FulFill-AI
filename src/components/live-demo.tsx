import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Live Demo · Presentation Mode
 * ============================================================
 * A fully-scripted ~52s cinematic overlay designed for investor
 * pitches and university demos. When "Start Live Demo" is clicked
 * the component takes over: it advances through 10 chapters, fires
 * the real optimizer at chapter 5, and closes on an executive summary.
 *
 * The overlay is intentionally non-blocking — the underlying warehouse
 * map stays visible so the audience can watch the digital twin work.
 */

interface Chapter {
  id: number;
  at: number;          // ms into the demo when this chapter starts
  title: string;
  body: string;
  kicker: string;
  icon: (className: string) => React.ReactElement;
}

const CH: Chapter[] = [
  { id: 1, at: 0,     kicker: "Digital twin",       title: "Warehouse Overview",          body: "412k sqft · 70 racks · 14,208 SKUs · 84 pickers live on the floor.",              icon: (c) => <IcWarehouse className={c} /> },
  { id: 2, at: 4000,  kicker: "Ingest",             title: "Order Upload",                 body: "74 orders · 312 pick lines streaming in from the WMS.",                          icon: (c) => <IcUpload    className={c} /> },
  { id: 3, at: 8000,  kicker: "Data quality",       title: "Validation",                   body: "Schema, SKU coverage and shift feasibility checked in 0.4s.",                     icon: (c) => <IcCheck     className={c} /> },
  { id: 4, at: 12000, kicker: "FulfillAI",          title: "AI Analysis",                  body: "Neural planner clusters SKU affinity, scores congestion, weights demand.",       icon: (c) => <IcSparkle   className={c} /> },
  { id: 5, at: 17000, kicker: "Solver · trigger",   title: "Picking Route Optimization",   body: "OR-Tools VRP with pick-face reach & dwell-time constraints.",                     icon: (c) => <IcRoute     className={c} /> },
  { id: 6, at: 22000, kicker: "Live floor",         title: "Worker Navigation",            body: "Picker follows the optimized path · Waze-style turn-by-turn.",                    icon: (c) => <IcCompass   className={c} /> },
  { id: 7, at: 30000, kicker: "Reslotting",         title: "Slotting Optimization",        body: "Fast movers pulled to Zone A · SKU-K7B reslotted, saves 2.4 mi/day.",              icon: (c) => <IcGrid      className={c} /> },
  { id: 8, at: 35000, kicker: "Copilot",            title: "AI Insights",                  body: "Aisle F congestion @ 14:00 smoothed · 12 batches auto-formed.",                    icon: (c) => <IcBrain     className={c} /> },
  { id: 9, at: 40000, kicker: "Impact",             title: "Updated KPIs",                 body: "Distance −33% · Pick time −36% · Labor cost −24% · Pick rate +48%.",              icon: (c) => <IcChart     className={c} /> },
  { id:10, at: 45000, kicker: "Board readout",      title: "Executive Summary",            body: "Every warehouse optimized in 52 seconds.",                                          icon: (c) => <IcTrophy    className={c} /> },
];

const OPTIMIZE_TRIGGER_AT = 17000;
const DEMO_END_AT = 52000;

/* ================================================================
 *  Public component
 * ================================================================*/

export interface LiveDemoProps {
  onTriggerOptimize: () => void;
  canTrigger: boolean;
}

export function LiveDemo({ onTriggerOptimize, canTrigger }: LiveDemoProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const triggeredRef = useRef<boolean>(false);

  const currentChapter = useMemo(() => {
    let ch = CH[0];
    for (const c of CH) if (elapsed >= c.at) ch = c;
    return ch;
  }, [elapsed]);

  useEffect(() => {
    if (!running) return;
    const tick = (now: number) => {
      const t = now - startRef.current;
      setElapsed(t);
      // Fire the real optimizer once, at the trigger point.
      if (!triggeredRef.current && t >= OPTIMIZE_TRIGGER_AT) {
        triggeredRef.current = true;
        onTriggerOptimize();
      }
      if (t < DEMO_END_AT + 3500) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, onTriggerOptimize]);

  const start = () => {
    if (!canTrigger) return;
    setElapsed(0);
    triggeredRef.current = false;
    setRunning(true);
  };

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setElapsed(0);
    triggeredRef.current = false;
  };

  return (
    <>
      <button
        onClick={start}
        disabled={running || !canTrigger}
        className="group relative overflow-hidden rounded-lg border border-slate-900/10 bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="relative z-10 flex items-center gap-2">
          <IcPlay className="h-3 w-3" />
          Start Live Demo
        </span>
      </button>

      {running && (
        <DemoOverlay
          elapsed={elapsed}
          chapter={currentChapter}
          onExit={stop}
        />
      )}
    </>
  );
}

/* ================================================================
 *  Overlay
 * ================================================================*/

function DemoOverlay({
  elapsed,
  chapter,
  onExit,
}: {
  elapsed: number;
  chapter: Chapter;
  onExit: () => void;
}) {
  const progress = Math.min(1, elapsed / DEMO_END_AT);
  const showSummary = elapsed >= CH[9].at;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(6,10,20,0.55) 100%)",
        }}
      />

      {/* Top status bar */}
      <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[oklch(0.16_0.04_260)]/85 px-4 py-2 text-white shadow-2xl backdrop-blur-xl">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
          FulfillAI · Live Demo
        </span>
        <span className="font-mono text-[10px] text-white/50">
          {String(Math.floor(elapsed / 1000)).padStart(2, "0")}s / {DEMO_END_AT / 1000}s
        </span>
        <span className="h-3 w-px bg-white/15" />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <button
          onClick={onExit}
          className="ml-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          Exit
        </button>
      </div>

      {/* Chapter card (bottom-center, non-blocking) */}
      {!showSummary && <ChapterCard chapter={chapter} />}

      {/* Chapter dots */}
      {!showSummary && (
        <div className="absolute left-1/2 bottom-4 flex -translate-x-1/2 items-center gap-1.5">
          {CH.map((c) => {
            const done = elapsed >= c.at + 1000;
            const active = c.id === chapter.id;
            return (
              <span
                key={c.id}
                className={`h-1 rounded-full transition-all duration-500 ${
                  active ? "w-6 bg-emerald-400" : done ? "w-3 bg-white/60" : "w-3 bg-white/20"
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Executive summary — final chapter */}
      {showSummary && <ExecutiveSummary onExit={onExit} />}
    </div>
  );
}

function ChapterCard({ chapter }: { chapter: Chapter }) {
  return (
    <div
      key={chapter.id}
      className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[oklch(0.14_0.04_260)]/92 p-5 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl chapter-in"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/40">
          {chapter.icon("h-6 w-6 text-emerald-300")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
              Chapter {String(chapter.id).padStart(2, "0")}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/50">
              {chapter.kicker}
            </span>
          </div>
          <h3 className="mt-1 font-display text-2xl leading-tight">
            {chapter.title}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
            {chapter.body}
          </p>
        </div>
      </div>
      <style>{`
        .chapter-in {
          animation: chapter-in 700ms cubic-bezier(0.2, 0.9, 0.2, 1);
        }
        @keyframes chapter-in {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
}

/* ================================================================
 *  Executive Summary — final board readout
 * ================================================================*/

function ExecutiveSummary({ onExit }: { onExit: () => void }) {
  const metrics = [
    { label: "Distance reduction", value: "−33%", sub: "17.8 → 11.9 km", tone: "emerald" as const },
    { label: "Labor reduction",    value: "−24%", sub: "$2.18 → $1.66 / order", tone: "emerald" as const },
    { label: "Time reduction",     value: "−36%", sub: "91 → 58 min / wave", tone: "emerald" as const },
    { label: "Estimated savings",  value: "$186K", sub: "annualized per wave shift", tone: "amber" as const },
    { label: "ROI",                value: "4.2×",  sub: "12-month payback", tone: "amber" as const },
    { label: "CO₂ reduction",      value: "4.2 kg", sub: "per wave · Scope 3", tone: "cyan" as const },
  ];

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[oklch(0.08_0.03_260)]/85 backdrop-blur-xl animate-fade-in p-4">
      <div className="relative my-auto w-[min(880px,94vw)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[oklch(0.16_0.05_260)] to-[oklch(0.11_0.04_260)] p-8 text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        {/* Close (X) button */}
        <button
          onClick={onExit}
          aria-label="Close executive summary"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {/* Header */}
        <div className="flex items-center gap-3 pr-12">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <IcSparkle className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
              Executive summary · Reno DC-04
            </div>
            <div className="font-display text-[26px] leading-tight">
              Warehouse optimized successfully.
            </div>
          </div>
        </div>


        {/* Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 metric-in"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                {m.label}
              </div>
              <div
                className={`mt-1 font-display text-3xl tabular-nums ${
                  m.tone === "emerald"
                    ? "text-emerald-300"
                    : m.tone === "amber"
                      ? "text-amber-300"
                      : "text-cyan-300"
                }`}
              >
                {m.value}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-white/50">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Copilot readout */}
        <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/25 ring-1 ring-emerald-400/40">
              <IcSparkle className="h-3 w-3 text-emerald-300" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
              FulfillAI Copilot · business value
            </span>
          </div>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/85">
            In under a minute FulfillAI cut walking distance by <span className="font-semibold text-emerald-300">a third</span>,
            trimmed labor cost per order by <span className="font-semibold text-emerald-300">24%</span>, and freed 33 minutes
            of picker time every wave — without a single dollar of automation capex.
            Applied across the 3-shift roster at Reno DC-04, the model projects{" "}
            <span className="font-semibold text-amber-300">~$186K annualized savings</span> on this warehouse alone,
            a <span className="font-semibold text-amber-300">4.2× ROI</span> on the software subscription, and a payback horizon
            comfortably inside the fiscal year. The optimizer runs continuously, so every future wave compounds the benefit —
            slotting drift, seasonal demand shifts and staffing changes are absorbed automatically.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-[11px] text-white/40">
            Ready for Series-A conversations · deploy across 4 more DCs.
          </div>
          <button
            onClick={onExit}
            className="rounded-lg bg-white/10 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-white/15"
          >
            Close demo
          </button>
        </div>
      </div>

      <style>{`
        .metric-in { animation: metric-in 700ms cubic-bezier(0.2,0.9,0.2,1) both; }
        @keyframes metric-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ================================================================
 *  Inline icons (kept local so this file is drop-in)
 * ================================================================*/

const Ic = (props: { className?: string; children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {props.children}
  </svg>
);

const IcPlay      = (p: { className?: string }) => <svg viewBox="0 0 24 24" className={p.className} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const IcWarehouse = (p: { className?: string }) => <Ic className={p.className}><path d="M3 21V9l9-6 9 6v12" /><path d="M8 21v-7h8v7" /></Ic>;
const IcUpload    = (p: { className?: string }) => <Ic className={p.className}><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></Ic>;
const IcCheck     = (p: { className?: string }) => <Ic className={p.className}><path d="M5 12l5 5 9-11" /></Ic>;
const IcSparkle   = (p: { className?: string }) => <svg viewBox="0 0 24 24" className={p.className} fill="currentColor"><path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" /></svg>;
const IcRoute     = (p: { className?: string }) => <Ic className={p.className}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6" /></Ic>;
const IcCompass   = (p: { className?: string }) => <Ic className={p.className}><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-4 2 2-6 4-2z" /></Ic>;
const IcGrid      = (p: { className?: string }) => <Ic className={p.className}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Ic>;
const IcBrain     = (p: { className?: string }) => <Ic className={p.className}><path d="M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 6 0V3" /><path d="M15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-6 0" /></Ic>;
const IcChart     = (p: { className?: string }) => <Ic className={p.className}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></Ic>;
const IcTrophy    = (p: { className?: string }) => <Ic className={p.className}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v3a3 3 0 0 1-3 3" /><path d="M7 5H4v3a3 3 0 0 0 3 3" /></Ic>;
