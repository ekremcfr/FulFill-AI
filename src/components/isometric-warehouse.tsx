import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

/* ============================================================
 * Isometric projection
 * ==========================================================*/
const ISO_COS = Math.cos(Math.PI / 6); // ≈ 0.866
const ISO_SIN = Math.sin(Math.PI / 6); // 0.5

function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * ISO_COS, (x + y) * ISO_SIN - z];
}
function pt(x: number, y: number, z = 0) {
  const [sx, sy] = iso(x, y, z);
  return `${sx.toFixed(1)},${sy.toFixed(1)}`;
}
function poly(...pts: Array<[number, number, number?]>) {
  return pts.map(([x, y, z]) => pt(x, y, z ?? 0)).join(" ");
}

/* ============================================================
 * Layout constants (world coordinates)
 * ==========================================================*/
const AISLES = ["A", "B", "C", "D", "E"] as const;
const SLOTS_PER_ROW = 7;
const RACK_W = 70;
const RACK_D = 22;
const RACK_H = 42;
const RACK_X_START = 60;
const RACK_X_SPACING = 92;
const AISLE_Y_START = 130;
const AISLE_Y_SPACING = 130;
const PICKING_AISLE_GAP = 42;

const FLOOR_W = 1100;
const FLOOR_H = 900;

/* ============================================================
 * Rack data
 * ==========================================================*/
export interface RackData {
  id: string;
  aisle: string;
  row: "T" | "B";
  slot: number;
  x: number; y: number; w: number; d: number; h: number;
  zone: "A" | "B" | "C";
  sku: string;
  productName: string;
  inventory: number;
  capacity: number;
  demand: "High" | "Medium" | "Low";
  freq: number;
  avgDaily: number;
  rec: string;
}

const PRODUCT_NAMES = [
  "Nitrile gloves L", "Bubble mailer 6×9", "USB-C cable 2m", "Thermal paper roll",
  "Kraft box 12×9×4", "Void fill 5cuft", "Shrink film 18\"", "Label roll 4×6",
  "Pallet strap 3/4\"", "Silica gel 5g", "Poly bag 10×13", "Corner protector",
  "Stretch wrap 80ga", "Tape 2\" clear", "Cutter blade #9",
];

const RACKS: RackData[] = (() => {
  let s = 7;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const list: RackData[] = [];
  AISLES.forEach((a, ai) => {
    const yTop = AISLE_Y_START + ai * AISLE_Y_SPACING;
    (["T", "B"] as const).forEach((row) => {
      const y = row === "T" ? yTop : yTop + RACK_D + PICKING_AISLE_GAP;
      for (let slot = 0; slot < SLOTS_PER_ROW; slot++) {
        const x = RACK_X_START + slot * RACK_X_SPACING;
        // Zone A near right (dock); zone tiering across width
        const zone: RackData["zone"] = slot >= 5 ? "A" : slot >= 2 ? "B" : "C";
        const baseFreq = zone === "A" ? 180 : zone === "B" ? 70 : 18;
        const freq = Math.max(1, Math.floor(baseFreq * (0.5 + rand() * 1.4)));
        const capacity = 100 + Math.floor(rand() * 120);
        const inventory = Math.floor(capacity * (0.25 + rand() * 0.7));
        const demand: RackData["demand"] = freq > 200 ? "High" : freq > 70 ? "Medium" : "Low";
        const rec =
          zone === "C" && freq > 120 ? "Reslot to Zone A" :
          inventory / capacity < 0.3 ? "Replenish inventory" :
          freq > 260 ? "Split across two bins" :
          zone === "A" && freq < 40 ? "Move to Zone B" :
          "Maintain current slot";
        list.push({
          id: `${a}-${row}${slot + 1}`,
          aisle: a, row, slot, x, y, w: RACK_W, d: RACK_D, h: RACK_H, zone,
          sku: `${a}${slot + 1}${row}-${(700 + Math.floor(rand() * 300)).toString(36).toUpperCase()}`,
          productName: PRODUCT_NAMES[Math.floor(rand() * PRODUCT_NAMES.length)],
          inventory, capacity, demand, freq, avgDaily: freq, rec,
        });
      }
    });
  });
  return list;
})();

const SORTED_RACKS = [...RACKS].sort((a, b) => (a.x + a.y) - (b.x + b.y));

/* ============================================================
 * Colors
 * ==========================================================*/
const ZONE_PALETTE = {
  A: { top: "#F4B93B", right: "#D18E14", left: "#8F5E00", stroke: "#5B3B00" },
  B: { top: "#3E5C90", right: "#2A426B", left: "#182C4C", stroke: "#0F1D34" },
  C: { top: "#C7CFDB", right: "#96A0B0", left: "#6A7383", stroke: "#3F4757" },
} as const;

function heatColor(freq: number) {
  const t = Math.min(freq / 320, 1);
  // teal → gold → red
  const r = Math.round(60 + t * 200);
  const g = Math.round(180 - Math.abs(t - 0.5) * 200);
  const b = Math.round(200 - t * 190);
  return { top: `rgb(${r},${g},${b})`, right: `rgb(${Math.round(r*0.75)},${Math.round(g*0.75)},${Math.round(b*0.75)})`, left: `rgb(${Math.round(r*0.55)},${Math.round(g*0.55)},${Math.round(b*0.55)})`, stroke: "#1a2438" };
}

/* ============================================================
 * Optimized picking route (world coords)
 * ==========================================================*/
const ROUTE_POINTS: Array<[number, number]> = [
  [900, 700],   // dock
  [700, 175],   // aisle A row T slot 6
  [610, 175],   // aisle A slot 5
  [610, 305],   // aisle B row T slot 5
  [430, 305],   // aisle B slot 3
  [430, 435],   // aisle C
  [700, 435],   // aisle C slot 6
  [700, 565],   // aisle D
  [430, 565],
  [430, 695],   // aisle E
  [700, 695],
  [900, 700],   // back to dock
];

/* ============================================================
 * Optimization cinematic — route through entrance → aisles → packing
 * ==========================================================*/
const ENTRANCE: [number, number] = [135, 65];
const PACKING: [number, number] = [400, 830];

const OPT_ROUTE: Array<[number, number]> = [
  ENTRANCE,
  [135, 305],
  [700, 305],
  [700, 175],
  [430, 175],
  [430, 305],
  [610, 305],
  [610, 435],
  [430, 435],
  [430, 565],
  [700, 565],
  [700, 695],
  [430, 695],
  [430, 830],
  PACKING,
];

// Waypoint → nearest rack (used to mark visited shelves)
function nearestRackId(x: number, y: number): string | null {
  let best: RackData | null = null;
  let bestD = Infinity;
  for (const r of RACKS) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.d / 2;
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best?.id ?? null;
}

const OPT_VISIT_SEQUENCE: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  // Skip entrance & packing endpoints
  for (let i = 1; i < OPT_ROUTE.length - 1; i++) {
    const id = nearestRackId(OPT_ROUTE[i][0], OPT_ROUTE[i][1]);
    if (id && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
})();

export type OptPhase = "idle" | "dim" | "scan" | "route" | "walk" | "done";

export const OPT_MESSAGES: Array<{ at: number; text: string }> = [
  { at: 0,    text: "Analyzing order clusters…" },
  { at: 1200, text: "Reading warehouse layout…" },
  { at: 2600, text: "Detecting bottlenecks…" },
  { at: 4200, text: "Calculating shortest paths…" },
  { at: 5800, text: "Building optimized route…" },
  { at: 12500, text: "Optimization complete." },
];

/* ============================================================
 * Workers & forklifts (paths projected to iso screen space)
 * ==========================================================*/
function isoPath(pts: Array<[number, number]>) {
  return "M " + pts.map(([x, y]) => pt(x, y)).join(" L ");
}

const WORKER_PATHS = [
  { id: "w1", color: "#F4A300", dur: 22, path: isoPath([[80, 305], [700, 305], [80, 305]]) },
  { id: "w2", color: "#183B6B", dur: 28, path: isoPath([[700, 565], [80, 565], [700, 565]]) },
  { id: "w3", color: "#0E9B6A", dur: 34, path: isoPath([[700, 435], [80, 435], [80, 175], [700, 175], [700, 435]]) },
];

const FORKLIFT_PATHS = [
  { id: "f1", dur: 30, path: isoPath([[900, 500], [700, 500], [700, 305], [900, 305], [900, 500]]) },
  { id: "f2", dur: 40, path: isoPath([[900, 600], [400, 600], [400, 695], [900, 695], [900, 600]]) },
];

/* ============================================================
 * Component
 * ==========================================================*/
export interface IsometricWarehouseProps {
  className?: string;
  onSelectRack?: (r: RackData | null) => void;
  /** Increment to trigger the optimization cinematic. */
  optimizeNonce?: number;
  onOptimizePhase?: (phase: OptPhase) => void;
  onOptimizeMessage?: (msg: string, index: number) => void;
  onOptimizeComplete?: () => void;
}

const VIEWBOX = { x: -820, y: -60, w: 1780, h: 1140 };

export function IsometricWarehouse({
  className,
  onSelectRack,
  optimizeNonce = 0,
  onOptimizePhase,
  onOptimizeMessage,
  onOptimizeComplete,
}: IsometricWarehouseProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [rot, setRot] = useState(0);
  const [labels, setLabels] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [optimized, setOptimized] = useState(true);
  const [hovered, setHovered] = useState<RackData | null>(null);
  const [selected, setSelected] = useState<RackData | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Optimization cinematic state
  const [phase, setPhase] = useState<OptPhase>("idle");
  const [scanT, setScanT] = useState(0); // 0..1 across scan phase
  const [routeDraw, setRouteDraw] = useState(0); // 0..1 draw progress
  const [walkT, setWalkT] = useState(0); // 0..1 worker progress
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState<Set<string>>(new Set());

  const selectRack = (r: RackData | null) => {
    setSelected(r);
    onSelectRack?.(r);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore drags started on shelves (they handle their own click)
    const target = e.target as SVGElement;
    if (target.closest?.("[data-rack-id]")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx, ty };
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      setTx(dragRef.current.tx + (e.clientX - dragRef.current.sx));
      setTy(dragRef.current.ty + (e.clientY - dragRef.current.sy));
    }
    if (hovered && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const next = Math.min(2.2, Math.max(0.5, scale * (1 - e.deltaY * 0.0012)));
    setScale(next);
  };

  // Prevent native wheel zoom of the page bubbling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const resetView = () => { setScale(1); setTx(0); setTy(0); setRot(0); };

  const cameraTransform = `translate(${tx} ${ty}) scale(${scale}) rotate(${rot})`;

  // Precompute floor corners
  const floor = poly([0, 0], [FLOOR_W, 0], [FLOOR_W, FLOOR_H], [0, FLOOR_H]);
  const zoneA = poly([RACK_X_START + 4.7 * RACK_X_SPACING, 60], [FLOOR_W - 350, 60], [FLOOR_W - 350, FLOOR_H - 60], [RACK_X_START + 4.7 * RACK_X_SPACING, FLOOR_H - 60]);
  const zoneB = poly([RACK_X_START + 1.7 * RACK_X_SPACING, 60], [RACK_X_START + 4.7 * RACK_X_SPACING, 60], [RACK_X_START + 4.7 * RACK_X_SPACING, FLOOR_H - 60], [RACK_X_START + 1.7 * RACK_X_SPACING, FLOOR_H - 60]);
  const zoneC = poly([30, 60], [RACK_X_START + 1.7 * RACK_X_SPACING, 60], [RACK_X_START + 1.7 * RACK_X_SPACING, FLOOR_H - 60], [30, FLOOR_H - 60]);

  const routeScreen = useMemo(() => "M " + ROUTE_POINTS.map(([x, y]) => pt(x, y)).join(" L "), []);

  // Optimized cinematic route path (world → iso screen)
  const optRouteScreen = useMemo(
    () => "M " + OPT_ROUTE.map(([x, y]) => pt(x, y)).join(" L "),
    [],
  );

  // Cumulative segment lengths for walk interpolation (world space)
  const optSegments = useMemo(() => {
    const segs: Array<{ from: [number, number]; to: [number, number]; len: number; cum: number }> = [];
    let cum = 0;
    for (let i = 0; i < OPT_ROUTE.length - 1; i++) {
      const [x1, y1] = OPT_ROUTE[i];
      const [x2, y2] = OPT_ROUTE[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ from: OPT_ROUTE[i], to: OPT_ROUTE[i + 1], len, cum });
      cum += len;
    }
    return { segs, total: cum };
  }, []);

  const workerWorldPos = useMemo<[number, number]>(() => {
    if (phase !== "walk" && phase !== "done") return ENTRANCE;
    const t = phase === "done" ? 1 : walkT;
    const target = t * optSegments.total;
    for (const s of optSegments.segs) {
      if (target <= s.cum + s.len || s === optSegments.segs[optSegments.segs.length - 1]) {
        const localT = Math.max(0, Math.min(1, (target - s.cum) / (s.len || 1)));
        return [
          s.from[0] + (s.to[0] - s.from[0]) * localT,
          s.from[1] + (s.to[1] - s.from[1]) * localT,
        ];
      }
    }
    return PACKING;
  }, [phase, walkT, optSegments]);

  // Cinematic sequence driver
  useEffect(() => {
    if (!optimizeNonce) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const rafs: number[] = [];
    const schedule = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const animate = (durMs: number, onUpdate: (t: number) => void, onDone?: () => void) => {
      const start = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / durMs);
        onUpdate(t);
        if (t < 1) rafs.push(requestAnimationFrame(step));
        else onDone?.();
      };
      rafs.push(requestAnimationFrame(step));
    };

    // Reset
    setVisited(new Set());
    setScanned(new Set());
    setScanT(0);
    setRouteDraw(0);
    setWalkT(0);

    // Phase: dim
    setPhase("dim");
    onOptimizePhase?.("dim");

    // Rotating AI messages
    OPT_MESSAGES.forEach((m, i) => {
      schedule(m.at, () => {
        if (cancelled) return;
        onOptimizeMessage?.(m.text, i);
      });
    });

    // Phase: scan (500 → 4500ms)
    schedule(500, () => {
      if (cancelled) return;
      setPhase("scan");
      onOptimizePhase?.("scan");
      animate(4000, (t) => {
        setScanT(t);
        // Progressively mark racks as scanned when scan line passes their world-x
        const scanX = t * FLOOR_W;
        setScanned((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const r of RACKS) {
            if (!next.has(r.id) && r.x + r.w / 2 <= scanX) {
              next.add(r.id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      });
    });

    // Phase: route draw (4500 → 6500ms)
    schedule(4500, () => {
      if (cancelled) return;
      setPhase("route");
      onOptimizePhase?.("route");
      animate(2000, (t) => setRouteDraw(t));
    });

    // Phase: walk (6500 → 12500ms)
    schedule(6500, () => {
      if (cancelled) return;
      setPhase("walk");
      onOptimizePhase?.("walk");
      animate(
        6000,
        (t) => {
          setWalkT(t);
          // Mark visited by segment index reached
          const target = t * optSegments.total;
          let reachedIdx = 0;
          for (let i = 0; i < optSegments.segs.length; i++) {
            if (target >= optSegments.segs[i].cum) reachedIdx = i;
          }
          // Waypoints 1..reachedIdx have been passed
          const newVisited = new Set<string>();
          for (let i = 0; i < Math.min(reachedIdx, OPT_VISIT_SEQUENCE.length); i++) {
            newVisited.add(OPT_VISIT_SEQUENCE[i]);
          }
          setVisited(newVisited);
        },
        () => {
          if (cancelled) return;
          setVisited(new Set(OPT_VISIT_SEQUENCE));
          setPhase("done");
          onOptimizePhase?.("done");
          onOptimizeComplete?.();
        },
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      rafs.forEach(cancelAnimationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimizeNonce]);

  const isOptActive = phase !== "idle";
  const workerScreen = iso(workerWorldPos[0], workerWorldPos[1]);


  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, oklch(0.985 0.004 250) 0%, oklch(0.955 0.008 250) 60%, oklch(0.925 0.012 250) 100%)",
        cursor: dragRef.current ? "grabbing" : "grab",
      }}
    >
      <svg
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="floor-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F0F3F8" />
            <stop offset="1" stopColor="#E1E7F0" />
          </linearGradient>
          <linearGradient id="dock-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FCE8B8" />
            <stop offset="1" stopColor="#F4C060" />
          </linearGradient>
          <radialGradient id="worker-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0.28" />
            <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
          </radialGradient>
          <pattern id="floor-lines" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform={`matrix(${ISO_COS} ${ISO_SIN} ${-ISO_COS} ${ISO_SIN} 0 0)`}>
            <rect width="20" height="20" fill="transparent" />
            <path d="M 20 0 L 0 0 0 20" stroke="#CDD5E0" strokeWidth="0.5" fill="none" />
          </pattern>
          <linearGradient id="opt-route-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#4ADE80" />
            <stop offset="0.5" stopColor="#22C55E" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <filter id="opt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="opt-strong-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={cameraTransform}>
          {/* FLOOR */}
          <polygon points={floor} fill="url(#floor-grad)" stroke="#B8C1D1" strokeWidth="1.2" />
          <polygon points={floor} fill="url(#floor-lines)" opacity="0.5" />

          {/* ZONE BANDS */}
          {!heatmap && (
            <g opacity="0.55">
              <polygon points={zoneA} fill="#F4A300" opacity="0.10" />
              <polygon points={zoneB} fill="#183B6B" opacity="0.06" />
              <polygon points={zoneC} fill="#183B6B" opacity="0.02" />
            </g>
          )}

          {/* AISLE STRIPES down each picking aisle */}
          {AISLES.map((a, ai) => {
            const yCenter = AISLE_Y_START + ai * AISLE_Y_SPACING + RACK_D + PICKING_AISLE_GAP / 2;
            return (
              <polygon
                key={`aisle-${a}`}
                points={poly([40, yCenter - 3], [FLOOR_W - 320, yCenter - 3], [FLOOR_W - 320, yCenter + 3], [40, yCenter + 3])}
                fill="#F4A300"
                opacity="0.18"
              />
            );
          })}

          {/* ENTRANCE (top-left opening) */}
          <g>
            <polygon
              points={poly([70, 40], [200, 40], [200, 90], [70, 90])}
              fill="#F4A300"
              opacity="0.35"
            />
            <text
              transform={`translate(${iso(135, 65)[0]} ${iso(135, 65)[1]}) rotate(-30)`}
              textAnchor="middle" fontSize="11" fontWeight="700" fill="#7A5300" letterSpacing="1.5"
            >
              ENTRANCE →
            </text>
          </g>

          {/* RECEIVING BUFFER (top) */}
          <g>
            <polygon points={poly([240, 40], [730, 40], [730, 100], [240, 100])} fill="#183B6B" opacity="0.06" stroke="#183B6B" strokeOpacity="0.3" strokeDasharray="6 6" />
            <text
              transform={`translate(${iso(485, 70)[0]} ${iso(485, 70)[1]}) rotate(-30)`}
              textAnchor="middle" fontSize="10" fontWeight="600" fill="#2A3D5C" letterSpacing="1.5"
            >
              RECEIVING BUFFER
            </text>
            {/* pallets */}
            {[280, 360, 440, 520, 600, 680].map((px) => (
              <Pallet key={px} x={px} y={55} />
            ))}
          </g>

          {/* PACKING STATIONS (bottom) */}
          <g>
            <polygon points={poly([50, 790], [720, 790], [720, 870], [50, 870])} fill="#183B6B" opacity="0.05" stroke="#183B6B" strokeOpacity="0.3" />
            <text
              transform={`translate(${iso(385, 830)[0]} ${iso(385, 830)[1]}) rotate(-30)`}
              textAnchor="middle" fontSize="10" fontWeight="600" fill="#2A3D5C" letterSpacing="1.5"
            >
              PACKING STATIONS
            </text>
            {[110, 230, 350, 470, 590].map((px, i) => (
              <PackingTable key={px} x={px} y={800} busy={i % 2 === 0} />
            ))}
          </g>

          {/* LOADING DOCK (right) */}
          <g>
            <polygon
              points={poly([770, 130], [1050, 130], [1050, 760], [770, 760])}
              fill="url(#dock-grad)" stroke="#B47A00" strokeWidth="1"
            />
            <text
              transform={`translate(${iso(910, 445)[0]} ${iso(910, 445)[1]}) rotate(-30)`}
              textAnchor="middle" fontSize="14" fontWeight="700" fill="#6E4700" letterSpacing="2"
            >
              LOADING DOCK
            </text>
            {/* dock doors along right wall (world x=1050) */}
            {[180, 300, 420, 540, 660].map((yy) => (
              <DockDoor key={yy} x={1050} y={yy - 30} />
            ))}
            {/* Truck */}
            <Truck x={1075} y={300} />
          </g>

          {/* BACK WALL (visual depth) */}
          <polygon
            points={`${pt(0, 0, 0)} ${pt(FLOOR_W, 0, 0)} ${pt(FLOOR_W, 0, 60)} ${pt(0, 0, 60)}`}
            fill="#DCE3EE" stroke="#B8C1D1" strokeWidth="0.6"
          />
          {/* LEFT WALL */}
          <polygon
            points={`${pt(0, 0, 0)} ${pt(0, FLOOR_H, 0)} ${pt(0, FLOOR_H, 60)} ${pt(0, 0, 60)}`}
            fill="#CFD7E4" stroke="#B8C1D1" strokeWidth="0.6"
          />

          {/* OPTIMIZED ROUTE */}
          {optimized && (
            <g>
              <path d={routeScreen} fill="none" stroke="#183B6B" strokeOpacity="0.18" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d={routeScreen} fill="none" stroke="#183B6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8" className="animate-route-dash" />
              {ROUTE_POINTS.slice(1, -1).map(([x, y], i) => {
                const [sx, sy] = iso(x, y);
                return (
                  <g key={i} transform={`translate(${sx} ${sy})`}>
                    <circle r="7" fill="white" stroke="#183B6B" strokeWidth="1.8" />
                    <text y="2.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#183B6B">{i + 1}</text>
                  </g>
                );
              })}
            </g>
          )}

          {/* AISLE LABELS on floor */}
          {labels && AISLES.map((a, ai) => {
            const yCenter = AISLE_Y_START + ai * AISLE_Y_SPACING + RACK_D + PICKING_AISLE_GAP / 2;
            const [sx, sy] = iso(40, yCenter);
            return (
              <g key={`label-${a}`} transform={`translate(${sx} ${sy}) rotate(-30)`}>
                <rect x="-16" y="-9" width="20" height="18" rx="3" fill="#183B6B" />
                <text textAnchor="middle" y="4" fontSize="11" fontWeight="700" fill="white">{a}</text>
              </g>
            );
          })}

          {/* RACKS */}
          {SORTED_RACKS.map((r) => (
            <Rack
              key={r.id}
              rack={r}
              heatmap={heatmap}
              showLabel={labels}
              selected={selected?.id === r.id}
              hovered={hovered?.id === r.id}
              onEnter={(e) => {
                setHovered(r);
                if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }
              }}
              onLeave={() => { setHovered(null); setTip(null); }}
              onClick={() => selectRack(selected?.id === r.id ? null : r)}
            />
          ))}

          {/* WORKERS */}
          {WORKER_PATHS.map((w) => (
            <g key={w.id}>
              <ellipse rx="8" ry="3" fill="url(#worker-shadow)">
                <animateMotion dur={`${w.dur}s`} repeatCount="indefinite" path={w.path} rotate="0" />
              </ellipse>
              <g>
                {/* body */}
                <rect x="-3" y="-14" width="6" height="10" rx="1.5" fill={w.color} />
                {/* head */}
                <circle cy="-17" r="2.8" fill="#F5D7A8" stroke="#8A6136" strokeWidth="0.4" />
                {/* helmet */}
                <path d="M -3 -18 L 3 -18 L 2.5 -20 A 2.5 2.5 0 0 0 -2.5 -20 Z" fill={w.color} />
                <animateMotion dur={`${w.dur}s`} repeatCount="indefinite" path={w.path} rotate="0" />
              </g>
            </g>
          ))}

          {/* FORKLIFTS */}
          {FORKLIFT_PATHS.map((f) => (
            <g key={f.id}>
              <Forklift />
              <animateMotion dur={`${f.dur}s`} repeatCount="indefinite" path={f.path} rotate="0" />
            </g>
          ))}
        </g>
      </svg>

      {/* CAMERA CONTROLS */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white/95 shadow-lg backdrop-blur">
          <CtrlBtn onClick={() => setScale((s) => Math.min(2.2, s * 1.15))} title="Zoom in">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          </CtrlBtn>
          <div className="mx-2 h-px bg-border" />
          <CtrlBtn onClick={() => setScale((s) => Math.max(0.5, s / 1.15))} title="Zoom out">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
          </CtrlBtn>
          <div className="mx-2 h-px bg-border" />
          <CtrlBtn onClick={resetView} title="Reset view">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          </CtrlBtn>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white/95 p-2 shadow-lg backdrop-blur">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Rotate</div>
          <input
            type="range" min={-15} max={15} step={1} value={rot}
            onChange={(e) => setRot(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer accent-[#183B6B]"
          />
          <div className="mt-1 text-center font-mono text-[10px] text-muted-foreground">{rot}°</div>
        </div>
      </div>

      {/* TOGGLES */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 rounded-xl border border-border bg-white/95 p-2 shadow-lg backdrop-blur">
        <Toggle label="Labels" active={labels} onChange={setLabels} />
        <Toggle label="Heatmap" active={heatmap} onChange={setHeatmap} />
        <Toggle label="Optimized route" active={optimized} onChange={setOptimized} />
      </div>

      {/* LEGEND */}
      <div className="absolute bottom-3 left-3 rounded-xl border border-border bg-white/95 p-3 text-[11px] shadow-lg backdrop-blur">
        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          {heatmap ? "Pick frequency" : "Zones"}
        </div>
        {!heatmap ? (
          <div className="space-y-1">
            <LegendRow color="#F4B93B" label="Zone A · Fast movers" />
            <LegendRow color="#3E5C90" label="Zone B · Medium" />
            <LegendRow color="#C7CFDB" label="Zone C · Slow" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, rgb(60,180,200), rgb(200,180,100), rgb(240,60,40))" }} />
            <span className="text-muted-foreground">low → high</span>
          </div>
        )}
      </div>

      {/* HOVER TOOLTIP */}
      {hovered && tip && (
        <div
          className="pointer-events-none absolute z-20 w-64 rounded-xl border border-border bg-white/98 p-3 text-[12px] shadow-xl backdrop-blur"
          style={{ left: Math.min(tip.x + 14, (containerRef.current?.clientWidth ?? 800) - 280), top: Math.min(tip.y + 14, (containerRef.current?.clientHeight ?? 800) - 220) }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-foreground">{hovered.id}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              hovered.zone === "A" ? "bg-amber-100 text-amber-800" :
              hovered.zone === "B" ? "bg-blue-100 text-blue-800" :
              "bg-slate-100 text-slate-700"
            }`}>Zone {hovered.zone}</span>
          </div>
          <div className="font-medium text-foreground">{hovered.productName}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">SKU {hovered.sku}</div>
          <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
            <span className="text-muted-foreground">Inventory</span>
            <span className="text-right font-mono text-foreground">{hovered.inventory} / {hovered.capacity}</span>
            <span className="text-muted-foreground">Demand</span>
            <span className={`text-right font-medium ${
              hovered.demand === "High" ? "text-red-600" : hovered.demand === "Medium" ? "text-amber-600" : "text-slate-500"
            }`}>{hovered.demand}</span>
            <span className="text-muted-foreground">Pick freq.</span>
            <span className="text-right font-mono text-foreground">{hovered.freq}/day</span>
            <span className="text-muted-foreground">Avg daily picks</span>
            <span className="text-right font-mono text-foreground">{hovered.avgDaily}</span>
          </div>
          <div className="mt-2.5 rounded-lg bg-primary-soft/70 px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-primary">AI recommendation</div>
            <div className="mt-0.5 text-[11px] font-medium text-foreground">{hovered.rec}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Sub-components
 * ==========================================================*/

interface RackProps {
  rack: RackData;
  heatmap: boolean;
  showLabel: boolean;
  hovered: boolean;
  selected: boolean;
  onEnter: (e: ReactPointerEvent<SVGGElement>) => void;
  onLeave: () => void;
  onClick: () => void;
  optState?: "off" | "pending" | "scanning" | "scanned" | "visited";
}

const OPT_PALETTE = {
  pending:  { top: "#F4A300", right: "#B47A00", left: "#7A5300", stroke: "#4A2E00" },
  scanning: { top: "#3EE0E0", right: "#1AA7B8", left: "#0B6D7A", stroke: "#053540" },
  scanned:  { top: "#F4B93B", right: "#D18E14", left: "#8F5E00", stroke: "#5B3B00" },
  visited:  { top: "#22C55E", right: "#15803D", left: "#0F5D2D", stroke: "#064221" },
} as const;

function Rack({ rack, heatmap, showLabel, hovered, selected, onEnter, onLeave, onClick, optState = "off" }: RackProps) {
  const c =
    optState !== "off" && optState in OPT_PALETTE
      ? OPT_PALETTE[optState as keyof typeof OPT_PALETTE]
      : heatmap
        ? heatColor(rack.freq)
        : ZONE_PALETTE[rack.zone];
  const { x, y, w, d, h } = rack;
  const top = poly([x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]);
  // LEFT face (x = x_min): visible on screen left
  const left = poly([x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h]);
  // RIGHT face (y = y_min): visible on screen right
  const right = poly([x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h]);

  // shelf tier lines on right face
  const tierYs = [h * 0.33, h * 0.66];
  return (
    <g
      data-rack-id={rack.id}
      onPointerEnter={onEnter}
      onPointerMove={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* shadow */}
      <ellipse
        cx={iso(x + w / 2, y + d / 2)[0]}
        cy={iso(x + w / 2, y + d / 2)[1] + 4}
        rx={(w * ISO_COS) * 0.85}
        ry={(d * ISO_SIN) * 1.2}
        fill="#0b1220"
        opacity="0.10"
      />
      <polygon points={left} fill={c.left} stroke={c.stroke} strokeWidth="0.5" />
      <polygon points={right} fill={c.right} stroke={c.stroke} strokeWidth="0.5" />
      {/* shelf tiers as darker lines on the right face */}
      {tierYs.map((tz, i) => (
        <line
          key={i}
          x1={iso(x, y, tz)[0]} y1={iso(x, y, tz)[1]}
          x2={iso(x + w, y, tz)[0]} y2={iso(x + w, y, tz)[1]}
          stroke={c.stroke} strokeOpacity="0.55" strokeWidth="0.7"
        />
      ))}
      {/* boxes on top */}
      {[0, 1, 2].map((i) => {
        const bx = x + 6 + i * ((w - 18) / 3);
        const by = y + 4;
        const bw = (w - 24) / 3;
        const bd = d - 8;
        const bh = 6 + (rack.inventory / rack.capacity) * 6;
        return (
          <g key={i}>
            <polygon
              points={poly([bx, by, h + bh], [bx + bw, by, h + bh], [bx + bw, by + bd, h + bh], [bx, by + bd, h + bh])}
              fill="#EFE4C8" stroke="#B79A5E" strokeWidth="0.4"
            />
            <polygon
              points={poly([bx + bw, by, h], [bx + bw, by + bd, h], [bx + bw, by + bd, h + bh], [bx + bw, by, h + bh])}
              fill="#D7C08A" stroke="#B79A5E" strokeWidth="0.4"
            />
          </g>
        );
      })}
      <polygon
        points={top}
        fill={c.top}
        stroke={selected ? "#183B6B" : c.stroke}
        strokeWidth={selected ? 2.4 : 0.6}
      />
      {(hovered || selected) && (
        <polygon
          points={top}
          fill="none"
          stroke="#F4A300"
          strokeWidth="2"
          opacity={hovered ? 0.9 : 0.7}
        />
      )}
      {showLabel && (
        <text
          x={iso(x + w / 2, y + d / 2, h)[0]}
          y={iso(x + w / 2, y + d / 2, h)[1] + 3}
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill={rack.zone === "A" ? "#4A2E00" : "#F5F7FB"}
          fontFamily="'JetBrains Mono', monospace"
          style={{ pointerEvents: "none" }}
        >
          {rack.id}
        </text>
      )}
    </g>
  );
}

function Pallet({ x, y }: { x: number; y: number }) {
  const w = 32, d = 22, h = 8;
  return (
    <g>
      <polygon points={poly([x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h])} fill="#B08040" stroke="#5D3E1A" strokeWidth="0.4" />
      <polygon points={poly([x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h])} fill="#8A5A2C" stroke="#5D3E1A" strokeWidth="0.4" />
      <polygon points={poly([x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h])} fill="#C79461" stroke="#5D3E1A" strokeWidth="0.4" />
      {/* box on pallet */}
      <polygon points={poly([x + 3, y + 3, h], [x + w - 3, y + 3, h], [x + w - 3, y + d - 3, h], [x + 3, y + d - 3, h])} fill="#EAD9B0" />
      <polygon points={poly([x + 3, y + 3, h], [x + w - 3, y + 3, h], [x + w - 3, y + 3, h + 14], [x + 3, y + 3, h + 14])} fill="#D0B87E" />
    </g>
  );
}

function PackingTable({ x, y, busy }: { x: number; y: number; busy: boolean }) {
  const w = 90, d = 50, h = 18;
  return (
    <g>
      <polygon points={poly([x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h])} fill="#5D6B82" stroke="#2E3646" strokeWidth="0.5" />
      <polygon points={poly([x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h])} fill="#3F4A5D" stroke="#2E3646" strokeWidth="0.5" />
      <polygon points={poly([x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h])} fill="#7A8AA3" stroke="#2E3646" strokeWidth="0.5" />
      {busy && (
        <>
          <polygon points={poly([x + 12, y + 10, h], [x + 42, y + 10, h], [x + 42, y + 34, h], [x + 12, y + 34, h])} fill="#F4E6C8" />
          <polygon points={poly([x + 12, y + 10, h], [x + 42, y + 10, h], [x + 42, y + 10, h + 10], [x + 12, y + 10, h + 10])} fill="#D4B683" />
          <polygon points={poly([x + 55, y + 15, h], [x + 78, y + 15, h], [x + 78, y + 32, h], [x + 55, y + 32, h])} fill="#183B6B" opacity="0.7" />
        </>
      )}
    </g>
  );
}

function DockDoor({ x, y }: { x: number; y: number }) {
  const w = 4, d = 55, h = 60;
  return (
    <g>
      <polygon points={poly([x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h])} fill="#3B2B0C" opacity="0.7" />
      <polygon points={poly([x - w, y, 0], [x, y, 0], [x, y, h], [x - w, y, h])} fill="#7A5A20" />
    </g>
  );
}

function Truck({ x, y }: { x: number; y: number }) {
  const cabW = 30, cabD = 90, cabH = 55;
  const trW = 25, trD = 90, trH = 70;
  // cab
  return (
    <g>
      {/* Trailer */}
      <polygon points={poly([x, y, 0], [x + trW, y, 0], [x + trW, y, trH], [x, y, trH])} fill="#E6EAF2" stroke="#5C6577" strokeWidth="0.6" />
      <polygon points={poly([x, y, 0], [x, y + trD, 0], [x, y + trD, trH], [x, y, trH])} fill="#C4CCDA" stroke="#5C6577" strokeWidth="0.6" />
      <polygon points={poly([x, y, trH], [x + trW, y, trH], [x + trW, y + trD, trH], [x, y + trD, trH])} fill="#F2F5FA" stroke="#5C6577" strokeWidth="0.6" />
      {/* Cab */}
      <polygon points={poly([x + trW, y + 5, 0], [x + trW + cabW, y + 5, 0], [x + trW + cabW, y + 5, cabH], [x + trW, y + 5, cabH])} fill="#183B6B" stroke="#0B1E3F" strokeWidth="0.6" />
      <polygon points={poly([x + trW, y + 5, 0], [x + trW, y + 5 + cabD, 0], [x + trW, y + 5 + cabD, cabH], [x + trW, y + 5, cabH])} fill="#0B1E3F" stroke="#0B1E3F" strokeWidth="0.6" />
      <polygon points={poly([x + trW, y + 5, cabH], [x + trW + cabW, y + 5, cabH], [x + trW + cabW, y + 5 + cabD, cabH], [x + trW, y + 5 + cabD, cabH])} fill="#2A4B7C" stroke="#0B1E3F" strokeWidth="0.6" />
      {/* windshield */}
      <polygon points={poly([x + trW + cabW - 4, y + 8, cabH - 6], [x + trW + cabW - 4, y + 8 + cabD - 6, cabH - 6], [x + trW + cabW - 4, y + 8 + cabD - 6, cabH - 22], [x + trW + cabW - 4, y + 8, cabH - 22])} fill="#8BB4E8" opacity="0.6" />
    </g>
  );
}

function Forklift() {
  // Drawn at origin (0,0) — animateMotion translates it
  const bodyW = 22, bodyD = 14, bodyH = 12;
  const centerScreen = iso(bodyW / 2, bodyD / 2, 0);
  return (
    <g transform={`translate(${-centerScreen[0]} ${-centerScreen[1]})`}>
      <ellipse cx={iso(bodyW / 2, bodyD / 2)[0]} cy={iso(bodyW / 2, bodyD / 2)[1] + 3} rx="12" ry="4" fill="#0b1220" opacity="0.18" />
      {/* base */}
      <polygon points={poly([0, 0, 0], [bodyW, 0, 0], [bodyW, 0, bodyH], [0, 0, bodyH])} fill="#F4A300" stroke="#7A5300" strokeWidth="0.5" />
      <polygon points={poly([0, 0, 0], [0, bodyD, 0], [0, bodyD, bodyH], [0, 0, bodyH])} fill="#C08000" stroke="#7A5300" strokeWidth="0.5" />
      <polygon points={poly([0, 0, bodyH], [bodyW, 0, bodyH], [bodyW, bodyD, bodyH], [0, bodyD, bodyH])} fill="#FFC24D" stroke="#7A5300" strokeWidth="0.5" />
      {/* mast */}
      <polygon points={poly([bodyW - 2, 4, bodyH], [bodyW, 4, bodyH], [bodyW, 4, bodyH + 22], [bodyW - 2, 4, bodyH + 22])} fill="#5C4400" />
      <polygon points={poly([bodyW - 2, bodyD - 4, bodyH], [bodyW, bodyD - 4, bodyH], [bodyW, bodyD - 4, bodyH + 22], [bodyW - 2, bodyD - 4, bodyH + 22])} fill="#5C4400" />
      {/* forks */}
      <polygon points={poly([bodyW, 3, 0], [bodyW + 10, 3, 0], [bodyW + 10, 4, 0], [bodyW, 4, 0])} fill="#3E3E3E" />
      <polygon points={poly([bodyW, bodyD - 4, 0], [bodyW + 10, bodyD - 4, 0], [bodyW + 10, bodyD - 3, 0], [bodyW, bodyD - 3, 0])} fill="#3E3E3E" />
      {/* driver */}
      <circle cx={iso(bodyW / 2, bodyD / 2, bodyH + 8)[0]} cy={iso(bodyW / 2, bodyD / 2, bodyH + 8)[1]} r="2.5" fill="#F5D7A8" stroke="#8A6136" strokeWidth="0.3" />
    </g>
  );
}

function CtrlBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center text-foreground/80 transition hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}

function Toggle({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
        active ? "bg-primary-soft text-primary" : "text-foreground/70 hover:bg-surface-muted"
      }`}
    >
      <span>{label}</span>
      <span className={`relative inline-flex h-3.5 w-6 rounded-full transition ${active ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition ${active ? "left-3" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-4 rounded-sm" style={{ background: color }} />
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}

export type { RackData as _RackData };
