import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  AISLES,
  WAREHOUSE_HEIGHT,
  WAREHOUSE_WIDTH,
} from "@/lib/warehouse-data";

export const Route = createFileRoute("/slotting")({
  head: () => ({
    meta: [
      { title: "AI Slotting · FulfillAI" },
      {
        name: "description",
        content:
          "AI product placement — animate SKUs to optimal shelves near packing.",
      },
    ],
  }),
  component: SlottingPage,
});

// ---------- Rack lookup ----------
type RackPos = { x: number; y: number; w: number; h: number; zone: "A" | "B" | "C" };
const RACK_MAP: Record<string, RackPos> = {};
AISLES.forEach((a) =>
  a.racks.forEach((r) => {
    RACK_MAP[r.id] = { x: r.x, y: r.y, w: r.w, h: r.h, zone: r.zone };
  }),
);

// Packing station center (from warehouse-map)
const PACK = { x: 1105, y: 110 };

function rackCenter(id: string) {
  const r = RACK_MAP[id];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
function distToPack(id: string) {
  const c = rackCenter(id);
  return Math.hypot(c.x - PACK.x, c.y - PACK.y);
}

// ---------- Products / recommendations ----------
interface Product {
  sku: string;
  name: string;
  popularity: number; // 0-100
  demand: number; // orders/day
  movement: number; // picks/day
  from: string;
  to: string;
  color: string;
  reason: string;
}

const PRODUCTS: Product[] = [
  {
    sku: "SKU-145",
    name: "Wireless Earbuds Pro",
    popularity: 96,
    demand: 412,
    movement: 88,
    from: "D-B9",
    to: "L-T1",
    color: "oklch(0.72 0.19 30)",
    reason: "412 picks/day at 24 m from pack — largest travel savings in cluster.",
  },
  {
    sku: "SKU-092",
    name: "Bubble Mailer 6×9",
    popularity: 93,
    demand: 388,
    movement: 82,
    from: "C-B8",
    to: "K-T2",
    color: "oklch(0.7 0.17 60)",
    reason: "Co-picked with SKU-145 in 71% of orders — pair adjacent for batching.",
  },
  {
    sku: "SKU-231",
    name: "USB-C Cable 2m",
    popularity: 88,
    demand: 274,
    movement: 74,
    from: "B-B7",
    to: "K-T4",
    color: "oklch(0.68 0.17 200)",
    reason: "Rising 22% demand — promote from Zone B into golden pick zone.",
  },
  {
    sku: "SKU-078",
    name: "Thermal Receipt Roll",
    popularity: 82,
    demand: 231,
    movement: 66,
    from: "E-B6",
    to: "J-T3",
    color: "oklch(0.65 0.19 320)",
    reason: "Currently in mid-aisle stoop zone — move to eye-level near pack.",
  },
  {
    sku: "SKU-312",
    name: "Nitrile Gloves L",
    popularity: 78,
    demand: 198,
    movement: 61,
    from: "A-B10",
    to: "L-T3",
    color: "oklch(0.7 0.16 145)",
    reason: "Farthest fast-mover — 41 m round trip becomes 9 m.",
  },
];

// ---------- KPIs ----------
interface KpiState {
  travel: number; // km/day
  pickRate: number; // picks/hr
  labor: number; // $/order
  congestion: number; // %
  savings: number; // $/yr
}
const BASELINE: KpiState = {
  travel: 17.8,
  pickRate: 118,
  labor: 2.14,
  congestion: 34,
  savings: 0,
};
const OPTIMIZED: KpiState = {
  travel: 11.9,
  pickRate: 168,
  labor: 1.63,
  congestion: 19,
  savings: 184000,
};

function useAnimatedNumber(target: number, duration = 1400) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ---------- Page ----------
function SlottingPage() {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [animating, setAnimating] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>(PRODUCTS[0].sku);
  const [sliderPct, setSliderPct] = useState(50);

  const appliedAll = applied.size === PRODUCTS.length;
  const kpiTarget: KpiState = useMemo(() => {
    const t = applied.size / PRODUCTS.length;
    return {
      travel: BASELINE.travel + (OPTIMIZED.travel - BASELINE.travel) * t,
      pickRate: BASELINE.pickRate + (OPTIMIZED.pickRate - BASELINE.pickRate) * t,
      labor: BASELINE.labor + (OPTIMIZED.labor - BASELINE.labor) * t,
      congestion:
        BASELINE.congestion + (OPTIMIZED.congestion - BASELINE.congestion) * t,
      savings: BASELINE.savings + (OPTIMIZED.savings - BASELINE.savings) * t,
    };
  }, [applied]);

  const travel = useAnimatedNumber(kpiTarget.travel);
  const pickRate = useAnimatedNumber(kpiTarget.pickRate);
  const labor = useAnimatedNumber(kpiTarget.labor);
  const congestion = useAnimatedNumber(kpiTarget.congestion);
  const savings = useAnimatedNumber(kpiTarget.savings);

  const applyOne = (sku: string) => {
    if (applied.has(sku) || animating.has(sku)) return;
    setAnimating((s) => new Set(s).add(sku));
    // trigger token position change on next tick so CSS transition fires
    requestAnimationFrame(() => {
      setApplied((s) => new Set(s).add(sku));
    });
    setTimeout(() => {
      setAnimating((s) => {
        const n = new Set(s);
        n.delete(sku);
        return n;
      });
    }, 1600);
  };

  const applyAll = () => {
    PRODUCTS.forEach((p, i) => {
      setTimeout(() => applyOne(p.sku), i * 220);
    });
  };

  const reset = () => {
    setApplied(new Set());
    setAnimating(new Set());
  };

  const activeProduct = PRODUCTS.find((p) => p.sku === selected) ?? PRODUCTS[0];

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden p-4 lg:flex-row lg:p-5">
        {/* Main map + comparison */}
        <section className="card-surface relative flex min-h-[520px] flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                AI Slotting Mode · 14,208 SKUs analyzed · confidence 94.2%
              </p>
              <h1 className="mt-0.5 font-display text-2xl text-foreground">
                Optimize product placement
              </h1>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <button
                onClick={reset}
                disabled={applied.size === 0}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                Reset
              </button>
              <button
                onClick={applyAll}
                disabled={appliedAll}
                className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {appliedAll ? "All applied" : "Apply all recommendations"}
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <BeforeAfterMap
              applied={applied}
              animating={animating}
              selected={selected}
              onSelect={setSelected}
              sliderPct={sliderPct}
              setSliderPct={setSliderPct}
              showSlider={applied.size > 0}
            />

            {/* AI explanation floating panel */}
            <div className="pointer-events-none absolute left-4 top-4 max-w-[320px] rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  AI Slotting Analyst
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-foreground">
                <span className="text-accent-foreground">{activeProduct.sku}</span>{" "}
                <span className="text-muted-foreground">→</span>{" "}
                <span className="font-semibold">
                  {activeProduct.from} → {activeProduct.to}
                </span>
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {activeProduct.reason}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                <Stat label="Popularity" value={`${activeProduct.popularity}`} />
                <Stat label="Demand/d" value={`${activeProduct.demand}`} />
                <Stat label="Movement" value={`${activeProduct.movement}`} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  Travel saved{" "}
                  <span className="font-semibold text-emerald-600">
                    −
                    {Math.round(
                      (distToPack(activeProduct.from) -
                        distToPack(activeProduct.to)) /
                        10,
                    )}
                    m
                  </span>
                </span>
                <span>
                  Zone{" "}
                  <span className="font-semibold text-foreground">
                    {RACK_MAP[activeProduct.from].zone} →{" "}
                    {RACK_MAP[activeProduct.to].zone}
                  </span>
                </span>
              </div>
            </div>

            {/* Comparison labels */}
            {applied.size > 0 && (
              <>
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-surface/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow">
                  Current layout
                </div>
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-primary/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground shadow">
                  Optimized layout
                </div>
              </>
            )}
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 border-t border-border p-3 md:grid-cols-5">
            <Kpi
              label="Travel / day"
              value={`${travel.toFixed(1)} km`}
              delta={applied.size > 0 ? `${(travel - BASELINE.travel).toFixed(1)} km` : undefined}
              positive={travel < BASELINE.travel}
            />
            <Kpi
              label="Pick rate"
              value={`${Math.round(pickRate)} / hr`}
              delta={applied.size > 0 ? `+${Math.round(pickRate - BASELINE.pickRate)}` : undefined}
              positive={pickRate > BASELINE.pickRate}
            />
            <Kpi
              label="Labor / order"
              value={`$${labor.toFixed(2)}`}
              delta={applied.size > 0 ? `−$${(BASELINE.labor - labor).toFixed(2)}` : undefined}
              positive={labor < BASELINE.labor}
            />
            <Kpi
              label="Congestion"
              value={`${congestion.toFixed(0)}%`}
              delta={applied.size > 0 ? `${(congestion - BASELINE.congestion).toFixed(0)} pt` : undefined}
              positive={congestion < BASELINE.congestion}
            />
            <Kpi
              label="Annualized savings"
              value={`$${Math.round(savings / 1000)}K`}
              delta={applied.size > 0 ? "projected" : undefined}
              positive
              accent
            />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-hidden lg:w-[400px]">
          <div className="card-surface flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Recommended moves
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Ranked by popularity × demand × distance
                </p>
              </div>
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                {applied.size}/{PRODUCTS.length}
              </span>
            </div>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {PRODUCTS.map((p) => {
                const done = applied.has(p.sku);
                const anim = animating.has(p.sku);
                const active = selected === p.sku;
                return (
                  <li
                    key={p.sku}
                    onMouseEnter={() => setSelected(p.sku)}
                    className={`cursor-pointer p-3 transition ${
                      active ? "bg-primary-soft/40" : "hover:bg-surface-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full ring-2 ring-surface"
                            style={{ background: p.color }}
                          />
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {p.sku}
                          </span>
                          {done && (
                            <span className="rounded bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-widest text-emerald-700">
                              Applied
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {p.name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-muted-foreground">
                            {p.from}
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3 w-3 text-primary"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                            {p.to}
                          </span>
                        </div>
                        <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                          <span>
                            Pop{" "}
                            <span className="font-mono text-foreground">
                              {p.popularity}
                            </span>
                          </span>
                          <span>
                            Dem{" "}
                            <span className="font-mono text-foreground">
                              {p.demand}
                            </span>
                          </span>
                          <span>
                            Mov{" "}
                            <span className="font-mono text-foreground">
                              {p.movement}
                            </span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          applyOne(p.sku);
                        }}
                        disabled={done || anim}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                          done
                            ? "bg-emerald-500/15 text-emerald-700"
                            : anim
                            ? "bg-primary/70 text-primary-foreground"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        {done ? "✓" : anim ? "Moving…" : "Apply"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card-surface p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                AI
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                Why this improves efficiency
              </h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Concentrating high-velocity SKUs within{" "}
              <span className="font-semibold text-foreground">
                Zone A (golden pick zone)
              </span>{" "}
              collapses average pick travel by{" "}
              <span className="font-semibold text-emerald-600">33%</span>. The
              model weighs popularity, forward demand, and co-pick affinity so
              batched orders traverse a{" "}
              <span className="font-semibold text-foreground">
                single U-shaped route
              </span>{" "}
              — reducing aisle crossings, wait time at congestion nodes, and
              stoop-picks. Projected annualized labor savings:{" "}
              <span className="font-semibold text-emerald-600">$184K</span>.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

// ---------- Sub-components ----------
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface-muted px-1.5 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  positive,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border p-2.5 ${
        accent ? "bg-accent-soft/50" : "bg-surface"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-display text-xl text-foreground tabular-nums">
          {value}
        </span>
        {delta && (
          <span
            className={`text-[10px] font-semibold ${
              positive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Warehouse SVG with animated tokens & before/after slider ----------
function BeforeAfterMap({
  applied,
  animating,
  selected,
  onSelect,
  sliderPct,
  setSliderPct,
  showSlider,
}: {
  applied: Set<string>;
  animating: Set<string>;
  selected: string;
  onSelect: (sku: string) => void;
  sliderPct: number;
  setSliderPct: (v: number) => void;
  showSlider: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  const startDrag = () => {
    dragRef.current = true;
  };
  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
      setSliderPct(pct);
    };
    const up = () => {
      dragRef.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [setSliderPct]);

  return (
    <div ref={containerRef} className="relative h-full w-full select-none">
      {/* Optimized (background, always visible) */}
      <WarehouseSvg
        applied={applied}
        animating={animating}
        selected={selected}
        onSelect={onSelect}
        variant="optimized"
      />
      {/* Current layout overlay clipped to left of slider */}
      {showSlider && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
        >
          <WarehouseSvg
            applied={new Set()}
            animating={new Set()}
            selected={selected}
            onSelect={onSelect}
            variant="current"
          />
        </div>
      )}
      {/* Slider handle */}
      {showSlider && (
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 cursor-ew-resize bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
          style={{ left: `${sliderPct}%` }}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        >
          <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-surface shadow-lg">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 6l-4 6 4 6M16 6l4 6-4 6" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function WarehouseSvg({
  applied,
  animating,
  selected,
  onSelect,
  variant,
}: {
  applied: Set<string>;
  animating: Set<string>;
  selected: string;
  onSelect: (sku: string) => void;
  variant: "optimized" | "current";
}) {
  const dim = variant === "current";
  return (
    <svg
      viewBox={`0 0 ${WAREHOUSE_WIDTH} ${WAREHOUSE_HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={`grid-${variant}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="oklch(0.92 0.008 250)" strokeWidth="1" />
        </pattern>
        <filter id={`tokenglow-${variant}`}>
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={WAREHOUSE_WIDTH} height={WAREHOUSE_HEIGHT} fill={dim ? "oklch(0.97 0.005 250)" : "oklch(0.985 0.004 250)"} />
      <rect x="20" y="20" width={WAREHOUSE_WIDTH - 40} height={WAREHOUSE_HEIGHT - 40} fill={`url(#grid-${variant})`} opacity="0.5" rx="8" />

      {/* Zone bands */}
      <g opacity={dim ? 0.5 : 1}>
        <rect x="780" y="40" width="380" height="680" fill="oklch(0.78 0.16 75 / 0.08)" rx="4" />
        <rect x="420" y="40" width="360" height="680" fill="oklch(0.34 0.09 260 / 0.04)" rx="4" />
        <rect x="40" y="40" width="380" height="680" fill="oklch(0.34 0.09 260 / 0.02)" rx="4" />
        <text x="800" y="60" fontSize="10" fontWeight="600" fill="oklch(0.55 0.14 70)" letterSpacing="1.5">ZONE A · GOLDEN</text>
        <text x="440" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE B</text>
        <text x="60" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE C</text>
      </g>

      {/* Packing station */}
      <g>
        <rect x="1050" y="40" width="110" height="140" fill="oklch(0.34 0.09 260 / 0.08)" stroke="oklch(0.34 0.09 260 / 0.5)" strokeWidth="1.2" rx="4" />
        <text x="1105" y="65" textAnchor="middle" fontSize="11" fontWeight="700" fill="oklch(0.35 0.09 260)">PACK</text>
      </g>

      {/* Racks */}
      {AISLES.map((a) => (
        <g key={a.id}>
          {a.racks.map((r) => {
            const isSource = PRODUCTS.some((p) => p.from === r.id);
            const isTarget = PRODUCTS.some((p) => p.to === r.id);
            const highlight = (isSource || isTarget) && !dim;
            return (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={
                  r.zone === "A"
                    ? "oklch(0.78 0.16 75 / 0.45)"
                    : r.zone === "B"
                    ? "oklch(0.34 0.09 260 / 0.28)"
                    : "oklch(0.34 0.09 260 / 0.1)"
                }
                stroke={
                  highlight
                    ? isTarget
                      ? "oklch(0.55 0.2 145)"
                      : "oklch(0.65 0.19 40)"
                    : "oklch(0.34 0.09 260 / 0.3)"
                }
                strokeWidth={highlight ? 1.5 : 0.6}
                rx="1.5"
                opacity={dim ? 0.65 : 1}
              />
            );
          })}
          <text
            x={a.racks[0].x + a.racks[0].w / 2}
            y={78}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="oklch(0.35 0.06 260)"
            fontFamily="'JetBrains Mono', monospace"
            opacity={dim ? 0.5 : 1}
          >
            {a.label}
          </text>
        </g>
      ))}

      {/* Movement paths (only optimized view, only for applied) */}
      {!dim &&
        PRODUCTS.map((p) => {
          if (!applied.has(p.sku)) return null;
          const from = rackCenter(p.from);
          const to = rackCenter(p.to);
          return (
            <path
              key={`path-${p.sku}`}
              d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 60} ${to.x} ${to.y}`}
              fill="none"
              stroke={p.color}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.5"
            />
          );
        })}

      {/* Product tokens */}
      {PRODUCTS.map((p) => {
        const showAtTarget = !dim && applied.has(p.sku);
        const rackId = showAtTarget ? p.to : p.from;
        const c = rackCenter(rackId);
        const isSel = selected === p.sku;
        const isAnim = !dim && animating.has(p.sku);
        return (
          <g
            key={p.sku}
            style={{
              transform: `translate(${c.x}px, ${c.y}px)`,
              transition: "transform 1.4s cubic-bezier(0.65, 0, 0.35, 1)",
              cursor: "pointer",
            }}
            onClick={() => onSelect(p.sku)}
            filter={isSel || isAnim ? `url(#tokenglow-${variant})` : undefined}
          >
            {isAnim && (
              <circle r="18" fill={p.color} opacity="0.25">
                <animate attributeName="r" from="10" to="28" dur="1.4s" repeatCount="1" />
                <animate attributeName="opacity" from="0.5" to="0" dur="1.4s" repeatCount="1" />
              </circle>
            )}
            <circle
              r={isSel ? 11 : 9}
              fill={p.color}
              stroke="white"
              strokeWidth="2.5"
              opacity={dim ? 0.85 : 1}
            />
            <text
              y={-14}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="oklch(0.2 0.03 260)"
              fontFamily="'JetBrains Mono', monospace"
              style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3 }}
            >
              {p.sku}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
