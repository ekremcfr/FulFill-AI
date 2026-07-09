import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import {
  AISLES,
  OPTIMIZED_ROUTE,
  NAIVE_ROUTE,
  PICK_TASKS,
  WAREHOUSE_HEIGHT,
  WAREHOUSE_WIDTH,
  type Zone,
} from "@/lib/warehouse-data";
import { askCopilot } from "@/lib/copilot.functions";
import { LiveDemo } from "@/components/live-demo";


export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Smart Picking · FulfillAI Navigation" },
      {
        name: "description",
        content:
          "Live warehouse navigation for pickers. FulfillAI plans the route, guides every pick, and cuts travel by 30%+.",
      },
    ],
  }),
  component: SmartPickingPage,
});

/* ================================================================
 *  Types & derived route data
 * ================================================================*/

type NavPhase = "idle" | "scanning" | "live" | "complete";
type RouteMode = "current" | "optimized" | "both";

interface PickStop {
  index: number;             // stop # (1..N)
  x: number;
  y: number;
  aisle: string;
  bin: string;
  sku: string;
  qty: number;
  order: string;
  reason: string;            // AI rationale for THIS stop
}

const DOCK: [number, number] = OPTIMIZED_ROUTE[0];

// Build 8 pick stops out of the interior waypoints of OPTIMIZED_ROUTE.
// Skip the pure "cross-aisle" hop points so stops feel like real bins.
const PICK_STOPS: PickStop[] = (() => {
  const pickIdx = [2, 3, 5, 7, 9, 10, 11]; // indexes into OPTIMIZED_ROUTE
  const skuPool = [
    { sku: "SKU-A2B", aisle: "A", bin: "A-B2", qty: 3, order: "SO-88291",
      reason: "Fast-mover · start of loop to warm up the picker" },
    { sku: "SKU-B4T", aisle: "B", bin: "B-T4", qty: 2, order: "SO-88291",
      reason: "Batched with A2B — same order, adjacent aisle" },
    { sku: "SKU-C5A", aisle: "C", bin: "C-T5", qty: 1, order: "SO-88291",
      reason: "Grouped nearby picks · avoids backtracking through B" },
    { sku: "SKU-F1A", aisle: "F", bin: "F-T1", qty: 2, order: "SO-88292",
      reason: "Aisle F traversed once — avoids 14:00 congestion spike" },
    { sku: "SKU-K7B", aisle: "K", bin: "K-B7", qty: 5, order: "SO-88292",
      reason: "High-demand SKU · prioritized before shift refill window" },
    { sku: "SKU-K3T", aisle: "K", bin: "K-T3", qty: 1, order: "SO-88293",
      reason: "Stacked with K7B — zero extra travel" },
    { sku: "SKU-H3A", aisle: "H", bin: "H-T3", qty: 1, order: "SO-88293",
      reason: "Returns toward dock · minimizes cross-aisle travel" },
  ];
  return pickIdx.map((rIdx, i) => ({
    index: i + 1,
    x: OPTIMIZED_ROUTE[rIdx][0],
    y: OPTIMIZED_ROUTE[rIdx][1],
    ...skuPool[i],
  }));
})();

const SCAN_MESSAGES = [
  "Scanning warehouse…",
  "Loading order history…",
  "Grouping nearby picks…",
  "Detecting congestion in Aisle F…",
  "Calculating shortest path…",
  "Generating optimal navigation…",
  "Optimization complete.",
];

// Extend the route: after the final pick, worker heads to the PACKING station
// (not back to the dock). This is the last leg of the journey.
const PACKING_POINT: [number, number] = [1105, 130];

// Full navigation route: dock start → picks (via OPTIMIZED_ROUTE interior) →
// packing station. Strips the last two "return to dock" points from
// OPTIMIZED_ROUTE and appends a clean corridor + packing approach.
const NAV_ROUTE: Array<[number, number]> = (() => {
  // Keep dock start + all interior waypoints up to and including the last pick
  // (aisle H at index 11). Then append a corridor path to packing.
  const trimmed = OPTIMIZED_ROUTE.slice(0, 12).map(
    ([x, y]) => [x, y] as [number, number],
  );
  return [
    ...trimmed,
    [816, 130], // up to top corridor
    [1050, 130], // over to packing
    PACKING_POINT, // arrive
  ];
})();


// Pre-computed segment lengths for the nav route → used to place the worker
// at any progress fraction 0..1.
const OPT_SEGMENTS = (() => {
  const segs: { len: number; from: [number, number]; to: [number, number] }[] = [];
  for (let i = 0; i < NAV_ROUTE.length - 1; i++) {
    const a = NAV_ROUTE[i];
    const b = NAV_ROUTE[i + 1];
    segs.push({
      from: a,
      to: b,
      len: Math.hypot(b[0] - a[0], b[1] - a[1]),
    });
  }
  const total = segs.reduce((s, x) => s + x.len, 0);
  return { segs, total };
})();

function pointAt(fraction: number): [number, number] {
  const target = fraction * OPT_SEGMENTS.total;
  let acc = 0;
  for (const s of OPT_SEGMENTS.segs) {
    if (acc + s.len >= target) {
      const t = (target - acc) / s.len;
      return [s.from[0] + (s.to[0] - s.from[0]) * t,
              s.from[1] + (s.to[1] - s.from[1]) * t];
    }
    acc += s.len;
  }
  return NAV_ROUTE[NAV_ROUTE.length - 1];
}

// Fraction along the total route at which each pick stop sits.
const PICK_FRACTIONS = (() => {
  return PICK_STOPS.map((stop) => {
    let acc = 0;
    for (const s of OPT_SEGMENTS.segs) {
      if (s.to[0] === stop.x && s.to[1] === stop.y) {
        return (acc + s.len) / OPT_SEGMENTS.total;
      }
      acc += s.len;
    }
    return 0;
  });
})();

// Packing station is the final destination (progress = 1.0).
const PACKING_FRACTION = 1.0;


const LIVE_DURATION_MS = 32000; // ~32s live picker traversal

/* ================================================================
 *  Root page
 * ================================================================*/

function SmartPickingPage() {
  const [phase, setPhase] = useState<NavPhase>("idle");
  const [scanIdx, setScanIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 along optimized route
  const [routeMode, setRouteMode] = useState<RouteMode>("optimized");
  const [rationale, setRationale] = useState<string>("");
  const [rationaleLoading, setRationaleLoading] = useState(false);
  const askCopilotFn = useServerFn(askCopilot);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  // ---- optimization pipeline ---------------------------------------
  const startOptimization = useCallback(async () => {
    setPhase("scanning");
    setScanIdx(0);
    for (let i = 0; i < SCAN_MESSAGES.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, i === SCAN_MESSAGES.length - 1 ? 500 : 700));
      setScanIdx(i);
    }
    await new Promise((r) => setTimeout(r, 400));
    setPhase("live");
    setProgress(0);
    startRef.current = performance.now();

    // Kick off Copilot rationale in parallel
    setRationaleLoading(true);
    setRationale("");
    try {
      const res = await askCopilotFn({
        data: {
          messages: [
            {
              role: "user" as const,
              text: "In 80 words, explain why FulfillAI chose this optimized picking route for the current wave. Cover: batching nearby picks, avoiding congestion, SKU demand prioritization, and minimized cross-aisle travel. No headers — plain prose.",
            },
          ],
          contextText: `Wave: 74 orders / 312 lines. Baseline 17.8 km walking → optimized 11.9 km (−33%). 7 sequential stops through Aisles A → B → C → F → K → H → dock. Congestion detected in Aisle F at 14:00 — traversed once. SKU-K7B (high demand) prioritized. Batching applied to SO-88291 and SO-88293.`,
        },
      });
      setRationale(res.ok ? res.text : "AI narration temporarily unavailable.");
    } catch {
      setRationale("AI narration temporarily unavailable.");
    } finally {
      setRationaleLoading(false);
    }
  }, [askCopilotFn]);

  // ---- live traversal RAF ------------------------------------------
  useEffect(() => {
    if (phase !== "live") return;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / LIVE_DURATION_MS);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setPhase("complete");
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  const reset = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("idle");
    setProgress(0);
    setScanIdx(0);
    setRationale("");
  };

  // ---- derived live nav state --------------------------------------
  const visitedCount = PICK_FRACTIONS.filter((f) => progress >= f - 0.001).length;
  const currentStopIdx = Math.min(visitedCount, PICK_STOPS.length - 1);
  const nextStopIdx = Math.min(visitedCount, PICK_STOPS.length - 1);
  const remainingKm = (1 - progress) * 11.9;
  const remainingSec = Math.max(0, Math.round((1 - progress) * (LIVE_DURATION_MS / 1000)));
  const remainingPicks = PICK_STOPS.length - visitedCount;
  const efficiency = phase === "idle" ? 0 : Math.min(100, 74 + progress * 24);
  // Walking speed jitters around 1.35 m/s while live, freezes on complete.
  const walkSpeed = phase === "live" ? 1.28 + Math.sin(progress * 20) * 0.12 : phase === "complete" ? 0 : 0;
  // Approx total in-wave path length used for the turn-by-turn card (~480 m).
  const TOTAL_M = 480;

  // Detect when a pick has just been completed → flash toast for 1.6s.
  const [pickedFlash, setPickedFlash] = useState<PickStop | null>(null);
  const prevVisitedRef = useRef(0);
  useEffect(() => {
    if (visitedCount > prevVisitedRef.current && visitedCount <= PICK_STOPS.length) {
      const justPicked = PICK_STOPS[visitedCount - 1];
      setPickedFlash(justPicked);
      const t = window.setTimeout(() => setPickedFlash(null), 1800);
      prevVisitedRef.current = visitedCount;
      return () => window.clearTimeout(t);
    }
    prevVisitedRef.current = visitedCount;
  }, [visitedCount]);


  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 bg-[oklch(0.985_0.004_250)] p-3 lg:p-4">
        {/* Top bar — Tesla / Google Maps style header */}
        <TopBar
          phase={phase}
          routeMode={routeMode}
          onRouteMode={setRouteMode}
          onOptimize={startOptimization}
          onReset={reset}
        />

        {/* 70 / 30 main split */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
          {/* LEFT — Digital twin */}
          <section className="card-surface relative flex min-h-[420px] flex-col overflow-hidden">
            <NavigationMap
              phase={phase}
              progress={progress}
              routeMode={routeMode}
              visitedCount={visitedCount}
              currentStopIdx={currentStopIdx}
            />
            {/* Floating scan overlay */}
            {phase === "scanning" && <ScanOverlay msgIdx={scanIdx} />}
            {/* Floating BEFORE / AFTER strip (only after optimization) */}
            {(phase === "live" || phase === "complete") && (
              <BeforeAfterStrip progress={phase === "complete" ? 1 : progress} />
            )}
            {/* Google Maps style turn-by-turn card */}
            {(phase === "live" || phase === "complete") && (
              <TurnByTurnCard
                phase={phase}
                progress={progress}
                visitedCount={visitedCount}
                totalM={TOTAL_M}
                walkSpeed={walkSpeed}
              />
            )}
            {/* Pick-completed flash */}
            {pickedFlash && <PickedFlash stop={pickedFlash} />}
            {phase === "complete" && <ArrivalToast />}

          </section>

          {/* RIGHT — Live nav panel */}
          <aside className="flex min-h-0 flex-col gap-3">
            <LiveNavigationPanel
              phase={phase}
              currentStop={PICK_STOPS[currentStopIdx]}
              nextStop={PICK_STOPS[nextStopIdx]}
              remainingKm={remainingKm}
              remainingSec={remainingSec}
              remainingPicks={remainingPicks}
              efficiency={efficiency}
              walkSpeed={walkSpeed}
              progress={progress}
              visitedCount={visitedCount}
              totalStops={PICK_STOPS.length}
            />

            <AiNarrationCard
              phase={phase}
              rationale={rationale}
              loading={rationaleLoading}
              stop={PICK_STOPS[nextStopIdx]}
            />
          </aside>
        </div>

        {/* BOTTOM — Collapsible tabs */}
        <BottomPanel />
      </div>
    </AppShell>
  );
}

/* ================================================================
 *  Top bar (Tesla-style — glass, minimal, dense)
 * ================================================================*/

function TopBar({
  phase,
  routeMode,
  onRouteMode,
  onOptimize,
  onReset,
}: {
  phase: NavPhase;
  routeMode: RouteMode;
  onRouteMode: (m: RouteMode) => void;
  onOptimize: () => void;
  onReset: () => void;
}) {
  const canOptimize = phase === "idle";
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_6px_18px_-6px_rgba(16,185,129,0.6)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Zm0 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${phase === "live" ? "animate-pulse bg-emerald-500" : phase === "complete" ? "bg-emerald-500" : "bg-slate-400"}`} />
            FulfillAI Navigation
            <span className="font-mono text-[10px] text-slate-400">
              · {phase === "idle" ? "Standby" : phase === "scanning" ? "Planning" : phase === "live" ? "En route" : "Arrived"}
            </span>
          </div>
          <div className="font-display text-[15px] leading-tight text-foreground">
            Reno DC-04 · Wave 3
          </div>
        </div>
      </div>

      {/* Route mode segmented control */}
      <div className="flex items-center gap-1 rounded-full border border-border bg-white p-1 text-[11px] shadow-sm">
        {(["current", "optimized", "both"] as RouteMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onRouteMode(m)}
            className={`rounded-full px-3 py-1 font-medium capitalize transition ${
              routeMode === m
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {m === "current" ? "Current" : m === "optimized" ? "Optimized" : "Compare"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <LiveDemo onTriggerOptimize={onOptimize} canTrigger={canOptimize} />
        {phase !== "idle" && (
          <button
            onClick={onReset}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Reset
          </button>
        )}
        <button
          onClick={onOptimize}
          disabled={!canOptimize}
          className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(16,185,129,0.65)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="relative z-10 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
            {phase === "idle" ? "Optimize with AI" : phase === "scanning" ? "Planning…" : phase === "live" ? "Navigating…" : "Route delivered"}
          </span>
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" />
        </button>
      </div>
    </header>
  );
}


/* ================================================================
 *  Navigation map — Digital twin with worker & routes
 * ================================================================*/

const ZONE_FILL: Record<Zone, string> = {
  A: "oklch(0.78 0.16 75 / 0.42)",
  B: "oklch(0.34 0.09 260 / 0.22)",
  C: "oklch(0.34 0.09 260 / 0.09)",
};
const ZONE_STROKE: Record<Zone, string> = {
  A: "oklch(0.6 0.14 70)",
  B: "oklch(0.34 0.09 260 / 0.55)",
  C: "oklch(0.34 0.09 260 / 0.28)",
};

function NavigationMap({
  phase,
  progress,
  routeMode,
  visitedCount,
  currentStopIdx,
}: {
  phase: NavPhase;
  progress: number;
  routeMode: RouteMode;
  visitedCount: number;
  currentStopIdx: number;
}) {
  const optimizedD = useMemo(
    () => "M " + NAV_ROUTE.map(([x, y]) => `${x} ${y}`).join(" L "),
    [],
  );

  const naiveD = useMemo(
    () => "M " + NAIVE_ROUTE.map(([x, y]) => `${x} ${y}`).join(" L "),
    [],
  );
  const worker = pointAt(progress);
  const showOpt = routeMode === "optimized" || routeMode === "both";
  const showCurrent = routeMode === "current" || routeMode === "both";

  return (
    <div className="relative flex-1 overflow-hidden">
      <svg
        viewBox={`0 0 ${WAREHOUSE_WIDTH} ${WAREHOUSE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Live warehouse navigation"
      >
        <defs>
          <pattern id="nav-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="oklch(0.93 0.006 250)" strokeWidth="1" />
          </pattern>
          <linearGradient id="opt-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="oklch(0.62 0.19 240)" />
            <stop offset="1" stopColor="oklch(0.65 0.15 210)" />
          </linearGradient>
          <radialGradient id="worker-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="oklch(0.62 0.19 240 / 0.8)" />
            <stop offset="1" stopColor="oklch(0.62 0.19 240 / 0)" />
          </radialGradient>
        </defs>

        {/* Floor */}
        <rect x="0" y="0" width={WAREHOUSE_WIDTH} height={WAREHOUSE_HEIGHT} fill="oklch(0.985 0.004 250)" />
        <rect x="20" y="20" width={WAREHOUSE_WIDTH - 40} height={WAREHOUSE_HEIGHT - 40} fill="url(#nav-grid)" opacity="0.55" rx="10" />
        <rect x="20" y="20" width={WAREHOUSE_WIDTH - 40} height={WAREHOUSE_HEIGHT - 40} fill="none" stroke="oklch(0.34 0.09 260 / 0.32)" strokeWidth="2" rx="10" />

        {/* Zones */}
        <g opacity="0.9">
          <rect x="780" y="40" width="380" height="680" fill="oklch(0.78 0.16 75 / 0.06)" rx="4" />
          <rect x="420" y="40" width="360" height="680" fill="oklch(0.34 0.09 260 / 0.035)" rx="4" />
          <rect x="40" y="40" width="380" height="680" fill="oklch(0.34 0.09 260 / 0.015)" rx="4" />
          <text x="60" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE C · SLOW</text>
          <text x="440" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE B · MEDIUM</text>
          <text x="800" y="60" fontSize="10" fontWeight="600" fill="oklch(0.55 0.14 70)" letterSpacing="1.5">ZONE A · FAST MOVERS</text>
        </g>

        {/* Dock (loading) */}
        <g>
          <rect x="1050" y="640" width="110" height="80" fill="oklch(0.96 0.05 85)" stroke="oklch(0.55 0.14 70)" strokeWidth="1" rx="4" />
          <text x="1105" y="682" textAnchor="middle" fontSize="10" fontWeight="700" fill="oklch(0.35 0.09 60)">LOADING DOCK</text>
          <text x="1105" y="700" textAnchor="middle" fontSize="9" fill="oklch(0.45 0.05 60)">Start / End</text>
        </g>

        {/* Packing station */}
        <g>
          <rect x="1050" y="40" width="110" height="140" fill="oklch(0.34 0.09 260 / 0.06)" stroke="oklch(0.34 0.09 260 / 0.4)" strokeWidth="1" strokeDasharray="4 4" rx="4" />
          <text x="1105" y="64" textAnchor="middle" fontSize="10" fontWeight="700" fill="oklch(0.35 0.09 260)">PACKING</text>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={1064} y={80 + i * 22} width="82" height="16" fill="oklch(0.99 0 0)" stroke="oklch(0.34 0.09 260 / 0.3)" rx="2" />
          ))}
        </g>

        {/* Aisles */}
        {AISLES.map((aisle) => (
          <g key={aisle.id}>
            {aisle.racks.map((r) => (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={ZONE_FILL[r.zone]}
                stroke={ZONE_STROKE[r.zone]}
                strokeWidth="0.75"
                rx="1.5"
              />
            ))}
            <text
              x={aisle.racks[0].x + aisle.racks[0].w / 2}
              y={78}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="oklch(0.4 0.06 260)"
              fontFamily="'JetBrains Mono', monospace"
            >
              {aisle.label}
            </text>
          </g>
        ))}

        {/* CURRENT (naive) route — gray dashed */}
        {showCurrent && (
          <g className="transition-opacity duration-500">
            <path
              d={naiveD}
              fill="none"
              stroke="oklch(0.6 0.01 260 / 0.55)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="10 8"
            />
          </g>
        )}

        {/* OPTIMIZED route — blue animated */}
        {showOpt && (
          <g>
            {/* halo */}
            <path
              d={optimizedD}
              fill="none"
              stroke="url(#opt-grad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.18"
            />
            {/* base */}
            <path
              d={optimizedD}
              fill="none"
              stroke="url(#opt-grad)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
            />
            {/* animated dash overlay */}
            <path
              d={optimizedD}
              fill="none"
              stroke="oklch(0.72 0.17 235)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="14 10"
              className="nav-flow"
            />
          </g>
        )}

        {/* Pick stops */}
        {showOpt &&
          PICK_STOPS.map((s, i) => {
            const visited = i < visitedCount;
            const current = i === currentStopIdx && phase === "live" && visitedCount < PICK_STOPS.length;
            const color = visited
              ? "oklch(0.65 0.18 155)"
              : current
                ? "oklch(0.7 0.19 60)"
                : "oklch(0.62 0.19 240)";
            return (
              <g key={s.index}>
                {current && (
                  <circle cx={s.x} cy={s.y} r="20" fill="none" stroke={color} strokeWidth="2" opacity="0.6">
                    <animate attributeName="r" values="12;28;12" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={s.x} cy={s.y} r={visited ? 11 : current ? 13 : 10} fill="white" stroke={color} strokeWidth={current ? 3 : 2} />
                <text x={s.x} y={s.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>
                  {visited ? "✓" : s.index}
                </text>
              </g>
            );
          })}

        {/* Dock start pin */}
        <g>
          <circle cx={DOCK[0]} cy={DOCK[1]} r="8" fill="oklch(0.35 0.09 60)" />
          <circle cx={DOCK[0]} cy={DOCK[1]} r="3" fill="white" />
        </g>

        {/* Packing station final destination pin */}
        {showOpt && (
          <g>
            {phase === "live" && visitedCount >= PICK_STOPS.length && (
              <circle cx={PACKING_POINT[0]} cy={PACKING_POINT[1]} r="18" fill="none" stroke="oklch(0.55 0.2 25)" strokeWidth="2" opacity="0.7">
                <animate attributeName="r" values="10;26;10" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <g transform={`translate(${PACKING_POINT[0]} ${PACKING_POINT[1] - 6})`}>
              <path d="M -8 6 L 0 -10 L 8 6 Z" fill="oklch(0.55 0.2 25)" stroke="white" strokeWidth="1.5" />
              <circle cx="0" cy="6" r="2" fill="oklch(0.55 0.2 25)" />
            </g>
          </g>
        )}


        {/* Worker (Tesla-blue) */}
        {(phase === "live" || phase === "complete") && showOpt && (
          <g transform={`translate(${worker[0]} ${worker[1]})`}>
            <circle r="26" fill="url(#worker-glow)" />
            <circle r="14" fill="oklch(0.62 0.19 240 / 0.25)" />
            <circle r="8" fill="oklch(0.62 0.19 240)" stroke="white" strokeWidth="2.5" />
            {phase === "live" && (
              <circle r="14" fill="none" stroke="oklch(0.62 0.19 240)" strokeWidth="1.5" opacity="0.7">
                <animate attributeName="r" values="10;22;10" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )}
      </svg>

      {/* Legend chip */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-full border border-border bg-white/95 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Visited</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full bg-amber-500" />Current</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "oklch(0.62 0.19 240)" }} />Upcoming</span>
      </div>

      <style>{`
        .nav-flow { stroke-dashoffset: 0; animation: nav-flow-anim 1.4s linear infinite; }
        @keyframes nav-flow-anim { to { stroke-dashoffset: -48; } }
      `}</style>
    </div>
  );
}

/* ================================================================
 *  Floating overlays
 * ================================================================*/

function ScanOverlay({ msgIdx }: { msgIdx: number }) {
  const progress = ((msgIdx + 1) / SCAN_MESSAGES.length) * 100;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[oklch(0.985_0.004_250)]/85 backdrop-blur-sm animate-fade-in">
      <div className="w-[min(440px,90%)] rounded-2xl border border-border bg-white/95 p-5 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/40">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-600" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
            <span className="absolute inset-0 rounded-xl border border-emerald-400/60 animate-ping" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-600">FulfillAI Optimizer</div>
            <div className="text-[15px] font-semibold text-foreground">Planning your wave</div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 font-mono text-[12px]">
          {SCAN_MESSAGES.map((m, i) => {
            const done = i < msgIdx;
            const current = i === msgIdx;
            return (
              <div key={m} className={`flex items-center gap-2 transition ${i > msgIdx ? "opacity-30" : "opacity-100"}`}>
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  done ? "bg-emerald-500 text-white" : current ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300" : "bg-slate-100 text-slate-400"
                }`}>{done ? "✓" : current ? "…" : ""}</span>
                <span className={current ? "text-foreground" : done ? "text-slate-500" : "text-slate-400"}>{m}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Google Maps-style turn-by-turn navigation card.
 * Shows the next stop with prominent distance + action, followed by the two
 * upcoming stops in a compact "Then" list. Continues updating past the final
 * pick to guide the worker into the packing station.
 */
function TurnByTurnCard({
  phase,
  progress,
  visitedCount,
  totalM,
  walkSpeed,
}: {
  phase: NavPhase;
  progress: number;
  visitedCount: number;
  totalM: number;
  walkSpeed: number;
}) {
  // Build upcoming waypoint list: remaining picks + packing at end.
  const upcoming: Array<{
    kind: "pick" | "packing";
    label: string;
    sub: string;
    fraction: number;
  }> = [];
  for (let i = visitedCount; i < PICK_STOPS.length; i++) {
    const s = PICK_STOPS[i];
    upcoming.push({
      kind: "pick",
      label: `Shelf ${s.bin}`,
      sub: `Pick ${s.qty}× ${s.sku}`,
      fraction: PICK_FRACTIONS[i],
    });
  }
  upcoming.push({
    kind: "packing",
    label: "Packing station",
    sub: "Drop off wave",
    fraction: PACKING_FRACTION,
  });

  const speed = Math.max(walkSpeed, 0.9); // avoid div-by-zero for ETA maths
  const distTo = (frac: number) => Math.max(0, Math.round((frac - progress) * totalM));
  const etaTo = (m: number) => Math.max(0, Math.round(m / speed));

  const first = upcoming[0];
  const rest = upcoming.slice(1, 3);
  const done = phase === "complete";

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (phase === "live") setDismissed(false);
  }, [phase]);
  if (dismissed) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 w-[260px] animate-fade-in">
      <div className="rounded-2xl border border-white/10 bg-[oklch(0.16_0.04_260)]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Header pill */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-400" : "animate-pulse bg-emerald-400"}`} />
          <span className="flex-1">{done ? "Arrived · Packing" : "Next stop"}</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Close"
            className="pointer-events-auto -mr-1 flex h-5 w-5 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>


        {/* Primary directive */}
        <div className="px-3.5 py-3 text-white">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                first.kind === "packing" ? "bg-orange-500/20 ring-1 ring-orange-400/40" : "bg-blue-500/20 ring-1 ring-blue-400/40"
              }`}
            >
              {first.kind === "packing" ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-orange-300" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
                  <path d="M3 7l9 4 9-4M12 11v10" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-300" fill="currentColor">
                  <path d="M12 2C7.6 2 4 5.6 4 10c0 5.6 8 12 8 12s8-6.4 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[17px] leading-tight text-white">
                {first.label}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-white/60">
                {first.sub}
              </div>
              <div className="mt-2 flex items-baseline gap-2 font-mono">
                <span className="text-[22px] font-semibold tabular-nums text-emerald-300">
                  {distTo(first.fraction)}
                </span>
                <span className="text-[11px] text-white/50">m</span>
                <span className="ml-1 text-[11px] text-white/40">
                  · {etaTo(distTo(first.fraction))}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Then list */}
        {rest.length > 0 && (
          <div className="border-t border-white/10 px-3.5 py-2.5">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">Then</div>
            <ul className="space-y-1.5">
              {rest.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        u.kind === "packing" ? "bg-orange-400" : "bg-blue-400"
                      }`}
                    />
                    <span className="truncate text-white/80">{u.label}</span>
                  </div>
                  <span className="font-mono text-[11px] text-white/50">{distTo(u.fraction)} m</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Brief "Picked X" flash when the worker completes a pick.
 */
function PickedFlash({ stop }: { stop: PickStop }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-2.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 shadow-lg">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-11" /></svg>
        </span>
        <span className="text-[11px] font-semibold text-emerald-800">
          Picked {stop.qty}× {stop.sku}
        </span>
        <span className="font-mono text-[10px] text-emerald-600">· {stop.bin}</span>
      </div>
    </div>
  );
}


function ArrivalToast() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-lg animate-fade-in">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l5 5 9-11" />
        </svg>
      </div>
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-widest text-emerald-700">Wave complete</div>
        <div className="text-[12px] font-semibold text-emerald-900">All 7 picks delivered</div>
      </div>
    </div>
  );
}

function BeforeAfterStrip({ progress }: { progress: number }) {
  const rows: [string, number, number, string][] = [
    ["Distance", 17.8, 11.9, "km"],
    ["Time", 91, 58, "min"],
    ["Labor cost", 2.18, 1.66, "$ / order"],
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 rounded-xl border border-border bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur animate-fade-in">
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Before → After</div>
      {rows.map(([label, from, to, unit]) => {
        const cur = from + (to - from) * progress;
        return (
          <div key={label} className="flex items-center gap-3 font-mono text-[11px]">
            <span className="w-16 text-slate-500">{label}</span>
            <span className="text-slate-400 line-through">{typeof from === "number" && from < 10 ? `$${from.toFixed(2)}` : from}</span>
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-emerald-500" fill="currentColor"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span className="font-semibold text-emerald-700 tabular-nums">
              {label === "Labor cost" ? `$${cur.toFixed(2)}` : cur.toFixed(label === "Distance" ? 1 : 0)}
            </span>
            <span className="text-slate-400">{unit}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
 *  Live Navigation Panel (right side)
 * ================================================================*/

function LiveNavigationPanel({
  phase,
  currentStop: _currentStop,
  nextStop,
  remainingKm,
  remainingSec,
  remainingPicks,
  efficiency,
  walkSpeed,
  progress,
  visitedCount,
  totalStops,
}: {
  phase: NavPhase;
  currentStop: PickStop;
  nextStop: PickStop;
  remainingKm: number;
  remainingSec: number;
  remainingPicks: number;
  efficiency: number;
  walkSpeed: number;
  progress: number;
  visitedCount: number;
  totalStops: number;
}) {

  const eta = new Date(Date.now() + remainingSec * 1000);
  const etaStr = eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const idle = phase === "idle";

  return (
    <div className="card-surface flex min-h-0 flex-col overflow-hidden">
      {/* Big current step banner (Waze style) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.22_0.06_260)] to-[oklch(0.15_0.05_260)] p-4 text-white">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${phase === "live" ? "animate-pulse bg-emerald-400" : "bg-white/30"}`} />
          {phase === "live" ? "Live navigation" : phase === "complete" ? "Route complete" : "Awaiting optimization"}
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            {phase === "complete" ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-300" fill="currentColor"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z" /></svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-white/60">
              {idle ? "No active route" : phase === "complete" ? "Arrived at packing" : remainingPicks === 0 ? "Final leg" : `Step ${Math.min(visitedCount + 1, totalStops)} of ${totalStops}`}
            </div>
            <div className="mt-0.5 truncate font-display text-[20px] leading-tight">
              {idle ? "Ready to plan" : phase === "complete" ? "Packing station" : remainingPicks === 0 ? "Head to Packing" : `Head to ${nextStop.bin}`}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-white/60">
              {idle ? "Click Optimize with AI to begin" : remainingPicks === 0 ? "Drop off wave · 74 orders" : `Pick ${nextStop.qty}× ${nextStop.sku} · Order ${nextStop.order}`}
            </div>
          </div>

        </div>

        {/* progress bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-white/50">
            <span>{Math.round(progress * 100)}% complete</span>
            <span>ETA {phase === "idle" ? "—" : etaStr}</span>
          </div>
        </div>
      </div>

      {/* Live metrics grid — 3×2 */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <NavMetric label="Remaining" value={idle ? "—" : `${remainingKm.toFixed(1)} km`} tone="default" />
        <NavMetric label="ETA" value={idle ? "—" : `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s`} tone="default" />
        <NavMetric label="Stops" value={idle ? "—" : `${remainingPicks} / ${totalStops}`} tone="default" />
        <NavMetric label="Speed" value={idle ? "—" : `${walkSpeed.toFixed(2)} m/s`} tone="default" />
        <NavMetric label="Current pick" value={idle || remainingPicks === 0 ? "—" : nextStop.sku} tone="default" />
        <NavMetric label="Efficiency" value={idle ? "—" : `${Math.round(efficiency)}%`} tone="emerald" />
      </div>


      {/* Upcoming stops list */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Route sequence</span>
          <span className="font-mono text-[10px] text-slate-400">{visitedCount}/{totalStops}</span>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {PICK_STOPS.map((s, i) => {
            const done = i < visitedCount;
            const active = phase === "live" && i === visitedCount;
            return (
              <li
                key={s.index}
                className={`flex items-center gap-3 border-b border-border/60 px-4 py-2 transition ${
                  active ? "bg-blue-50" : done ? "bg-emerald-50/40" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {done ? "✓" : s.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12px] font-semibold text-foreground">{s.bin}</span>
                    <span className="truncate font-mono text-[10px] text-slate-500">{s.sku}</span>
                  </div>
                  <div className="truncate text-[10.5px] text-slate-500">
                    Aisle {s.aisle} · qty {s.qty} · {s.order}
                  </div>
                </div>
                {active && <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">Now</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function NavMetric({ label, value, tone }: { label: string; value: string; tone: "default" | "emerald" }) {
  return (
    <div className="bg-white p-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-0.5 font-display text-lg tabular-nums ${tone === "emerald" ? "text-emerald-600" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

/* ================================================================
 *  AI narration card
 * ================================================================*/

function AiNarrationCard({
  phase,
  rationale,
  loading,
  stop,
}: {
  phase: NavPhase;
  rationale: string;
  loading: boolean;
  stop: PickStop;
}) {
  const idle = phase === "idle";
  return (
    <div className="card-surface flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-emerald-500/8 to-cyan-500/8 px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/40">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="currentColor">
            <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
          </svg>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-700">FulfillAI Copilot</div>
          <div className="text-[12.5px] font-semibold text-foreground">Why this route?</div>
        </div>
      </div>
      <div className="p-3.5 text-[12px] leading-relaxed text-slate-700">
        {idle ? (
          <p className="text-slate-500">
            Once you run the optimizer, FulfillAI explains the reasoning behind
            every leg of the route — batched picks, congestion avoidance, and
            demand prioritization.
          </p>
        ) : (
          <>
            <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[11.5px] text-blue-900">
              <span className="font-semibold">This stop: </span>{stop.reason}
            </div>
            {loading && !rationale ? (
              <div className="space-y-1.5">
                {[92, 78, 88, 60].map((w, i) => (
                  <div key={i} className="h-2 animate-pulse rounded bg-slate-100" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{rationale || "Building narration…"}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
 *  Bottom collapsible tabs
 * ================================================================*/

type BottomTab = "orders" | "validation" | "dataset" | "history";

function BottomPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BottomTab>("orders");
  const tabs: { id: BottomTab; label: string; count?: number }[] = [
    { id: "orders", label: "Orders", count: PICK_TASKS.length },
    { id: "validation", label: "Validation" },
    { id: "dataset", label: "Dataset" },
    { id: "history", label: "History" },
  ];
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                open && tab === t.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono ${
                  open && tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
        >
          {open ? "Collapse" : "Expand"}
          <svg viewBox="0 0 24 24" className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 15l6-6 6 6" /></svg>
        </button>
      </div>
      {open && (
        <div className="max-h-[240px] overflow-y-auto p-3 text-[12px] animate-fade-in">
          {tab === "orders" && <OrdersTable />}
          {tab === "validation" && <ValidationList />}
          {tab === "dataset" && <DatasetSummary />}
          {tab === "history" && <HistoryList />}
        </div>
      )}
    </div>
  );
}

function OrdersTable() {
  return (
    <table className="w-full text-[11.5px]">
      <thead className="text-[9.5px] uppercase tracking-widest text-slate-500">
        <tr>
          <th className="pb-2 text-left">Order</th>
          <th className="pb-2 text-left">SKU</th>
          <th className="pb-2 text-left">Aisle</th>
          <th className="pb-2 text-left">Bin</th>
          <th className="pb-2 text-right">Qty</th>
          <th className="pb-2 text-right">ETA</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {PICK_TASKS.map((t) => (
          <tr key={t.id} className="border-t border-border/60">
            <td className="py-1.5 text-foreground">{t.order}</td>
            <td className="py-1.5 text-foreground">{t.sku}</td>
            <td className="py-1.5 text-slate-500">{t.aisle}</td>
            <td className="py-1.5 text-slate-500">{t.bin}</td>
            <td className="py-1.5 text-right text-foreground">{t.qty}</td>
            <td className="py-1.5 text-right text-slate-500">{t.eta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValidationList() {
  const rows: [string, string][] = [
    ["Schema", "All required columns present"],
    ["SKU coverage", "100% mapped to warehouse bins"],
    ["Priority mix", "12% expedite · 88% standard"],
    ["Feasibility", "Fits within a single shift"],
  ];
  return (
    <div className="grid gap-1.5 md:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 p-2">
          <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">✓</span>
          <div>
            <div className="font-medium text-foreground">{k}</div>
            <div className="text-slate-500">{v}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DatasetSummary() {
  const stats: [string, string][] = [
    ["Wave", "74 orders"],
    ["Pick lines", "312"],
    ["Unique SKUs", "118"],
    ["Aisles touched", "7 of 12"],
    ["Source", "Reno DC-04 · demo"],
    ["Cadence", "2s telemetry"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {stats.map(([k, v]) => (
        <div key={k} className="rounded-md border border-border bg-white p-2">
          <div className="text-[9.5px] uppercase tracking-widest text-slate-500">{k}</div>
          <div className="mt-0.5 font-mono text-[12px] text-foreground">{v}</div>
        </div>
      ))}
    </div>
  );
}

function HistoryList() {
  const rows: [string, string, string][] = [
    ["Wave 2 · 08:14", "68 orders", "−31% travel"],
    ["Wave 1 · 06:02", "72 orders", "−28% travel"],
    ["Overnight · 23:40", "54 orders", "−35% travel"],
  ];
  return (
    <ul className="divide-y divide-border">
      {rows.map(([when, orders, delta]) => (
        <li key={when} className="flex items-center justify-between py-1.5">
          <span className="font-mono text-[11px] text-slate-600">{when}</span>
          <span className="text-[11px] text-slate-500">{orders}</span>
          <span className="text-[11px] font-semibold text-emerald-600">{delta}</span>
        </li>
      ))}
    </ul>
  );
}
