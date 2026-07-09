import { useEffect, useRef, useState } from "react";

/**
 * Presentation Mode — fully automated live demo for pitch presentations.
 *
 * When the user clicks "Start Live Demo", the component orchestrates a
 * ~50 second scripted timeline: it triggers the real warehouse optimizer
 * flow (which drives the isometric map, KPIs, insights feed, and copilot
 * summary) while a cinematic chapter overlay narrates each stage.
 *
 * The user does not need to click anything after starting the demo.
 */

interface Chapter {
  /** ms at which the chapter starts (relative to demo start) */
  at: number;
  kicker: string;
  title: string;
  body: string;
}

/** Total demo runtime: ~52 seconds */
const CHAPTERS: Chapter[] = [
  {
    at: 0,
    kicker: "01 · Initialization",
    title: "AI Scan",
    body: "FulfillAI is booting the neural planner and syncing digital-twin telemetry.",
  },
  {
    at: 4500,
    kicker: "02 · Perception",
    title: "Warehouse Analysis",
    body: "Scanning 70 racks · 2,410 bins · 14,208 SKUs across Reno DC-04.",
  },
  {
    at: 9500,
    kicker: "03 · Simulation",
    title: "Worker Movement",
    body: "Simulating live picker traffic and forklift routes on the floor.",
  },
  {
    at: 14500,
    kicker: "04 · Planning",
    title: "Route Optimization",
    body: "Neural planner is rebuilding the pick tour to eliminate backtracking.",
  },
  {
    at: 20000,
    kicker: "05 · Layout",
    title: "Slotting Optimization",
    body: "Relocating high-velocity SKUs closer to packing to cut travel.",
  },
  {
    at: 25500,
    kicker: "06 · Intelligence",
    title: "AI Insights",
    body: "Detecting congestion, batch opportunities, and slotting wins in real time.",
  },
  {
    at: 31000,
    kicker: "07 · Narrative",
    title: "Copilot Summary",
    body: "FulfillAI Copilot is authoring an executive summary for the ops director.",
  },
  {
    at: 36500,
    kicker: "08 · Results",
    title: "Updated KPIs",
    body: "Distance −33% · Pick time −36% · Labor cost −24% · Pick rate +48%.",
  },
  {
    at: 42000,
    kicker: "09 · Impact",
    title: "Business Impact",
    body: "Projected $1.8M annual labor savings and 29% CO₂ reduction per wave.",
  },
  {
    at: 47000,
    kicker: "10 · Wrap",
    title: "Final Executive Summary",
    body: "FulfillAI turns raw warehouse data into decisive, revenue-shaping decisions.",
  },
];

const DEMO_DURATION = 52000;
/** Delay from demo start until we fire the actual optimizer flow. */
const OPTIMIZER_KICKOFF = 3500;

interface Props {
  onTriggerOptimize: () => void;
  /** Whether the optimize flow is currently gated (idle/done). */
  canTrigger: boolean;
}

export function PresentationMode({ onTriggerOptimize, canTrigger }: Props) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = () => {
    setRunning(false);
    setElapsed(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => () => stop(), []);

  const start = () => {
    if (running || !canTrigger) return;
    setRunning(true);
    startedAt.current = performance.now();
    setElapsed(0);

    // Fire the real optimizer flow shortly after the intro chapter appears.
    timersRef.current.push(
      setTimeout(() => {
        onTriggerOptimize();
      }, OPTIMIZER_KICKOFF),
    );

    // End demo automatically.
    timersRef.current.push(setTimeout(() => stop(), DEMO_DURATION + 1500));

    const tick = (now: number) => {
      const e = now - startedAt.current;
      setElapsed(e);
      if (e < DEMO_DURATION + 1500) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const currentIdx = (() => {
    if (!running) return -1;
    let idx = -1;
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (elapsed >= CHAPTERS[i].at) idx = i;
    }
    return idx;
  })();
  const current = currentIdx >= 0 ? CHAPTERS[currentIdx] : null;
  const progress = Math.min(1, elapsed / DEMO_DURATION);

  return (
    <>
      {/* Launch button — sits next to Optimize Warehouse in the header */}
      <button
        onClick={start}
        disabled={running || !canTrigger}
        className="group relative overflow-hidden rounded-lg border border-indigo-400/40 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_24px_-8px_rgba(139,92,246,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="relative z-10 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          {running ? "Live Demo Running…" : "Start Live Demo"}
        </span>
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" />
      </button>

      {/* Cinematic chapter overlay */}
      <div
        className={`pointer-events-none fixed inset-0 z-[60] transition-opacity duration-500 ${
          running ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!running}
      >
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5,9,20,0) 30%, rgba(5,9,20,0.55) 100%)",
          }}
        />

        {/* Top status bar */}
        <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#050914]/85 px-4 py-2 text-[11px] text-white shadow-2xl backdrop-blur-xl">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-semibold uppercase tracking-[0.2em] text-emerald-300">
            FulfillAI · Live Demo
          </span>
          <span className="text-white/40">|</span>
          <span className="font-mono text-white/70">
            {(elapsed / 1000).toFixed(1)}s / {(DEMO_DURATION / 1000).toFixed(0)}s
          </span>
          <span className="text-white/40">|</span>
          <span className="font-mono text-white/70">
            Chapter {Math.max(1, currentIdx + 1)}/{CHAPTERS.length}
          </span>
          <button
            onClick={stop}
            className="ml-2 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Exit
          </button>
        </div>

        {/* Progress bar */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-indigo-400 transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Chapter card, bottom center — leaves the warehouse visible above */}
        {current && (
          <div
            key={currentIdx}
            className="absolute bottom-24 left-1/2 w-[min(680px,calc(100%-2.5rem))] -translate-x-1/2 animate-[chapter-in_.6s_ease-out]"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-[#050914]/90 p-5 text-white shadow-[0_30px_100px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
              <div
                className="pointer-events-none absolute -inset-16 opacity-30"
                style={{
                  background:
                    "conic-gradient(from 0deg, #6366F1, #10B981, #06B6D4, #A855F7, #6366F1)",
                  animation: "chapter-spin 6s linear infinite",
                }}
              />
              <div className="pointer-events-none absolute inset-[1px] rounded-2xl bg-[#050914]/94" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/40">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="currentColor">
                    <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                    {current.kicker}
                  </div>
                  <h2 className="mt-1 font-display text-3xl leading-tight text-white">
                    {current.title}
                  </h2>
                  <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-white/70">
                    {current.body}
                  </p>
                </div>
              </div>

              {/* Chapter dots */}
              <div className="relative mt-4 flex items-center gap-1.5">
                {CHAPTERS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < currentIdx
                        ? "bg-emerald-400/70"
                        : i === currentIdx
                          ? "bg-white"
                          : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes chapter-spin { to { transform: rotate(360deg); } }
        @keyframes chapter-in {
          0%   { opacity: 0; transform: translate(-50%, 16px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
