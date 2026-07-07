export type Zone = "A" | "B" | "C";

export interface Rack {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: Zone;
  utilization: number; // 0..1
  sku: string;
}

export interface Aisle {
  id: string;
  label: string;
  racks: Rack[];
}

// Generate a realistic warehouse layout
// Coordinate system: 0..1200 width, 0..760 height
export const WAREHOUSE_WIDTH = 1200;
export const WAREHOUSE_HEIGHT = 760;

let _seed = 42;
function rand() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}

function makeAisle(index: number, label: string, xOffset: number): Aisle {
  const racks: Rack[] = [];
  const rackW = 68;
  const rackH = 26;
  const gap = 6;
  const startY = 90;
  const distanceFromDock = Math.abs(index - 11);
  const baseZone: Zone = distanceFromDock <= 3 ? "A" : distanceFromDock <= 7 ? "B" : "C";

  for (let i = 0; i < 10; i++) {
    const rowTop = startY + i * (rackH * 2 + gap);
    racks.push({
      id: `${label}-T${i + 1}`,
      x: xOffset, y: rowTop, w: rackW, h: rackH,
      zone: baseZone, utilization: 0.35 + rand() * 0.6, sku: `SKU-${label}${i + 1}A`,
    });
    racks.push({
      id: `${label}-B${i + 1}`,
      x: xOffset, y: rowTop + rackH, w: rackW, h: rackH,
      zone: baseZone, utilization: 0.35 + rand() * 0.6, sku: `SKU-${label}${i + 1}B`,
    });
  }
  return { id: label, label, racks };
}

export const AISLES: Aisle[] = Array.from({ length: 12 }, (_, i) =>
  makeAisle(i, String.fromCharCode(65 + i), 60 + i * 90),
);

// Restore real random (only used at module init above)

export interface PickTask {
  id: string;
  order: string;
  sku: string;
  aisle: string;
  bin: string;
  qty: number;
  eta: string;
}

export const PICK_TASKS: PickTask[] = [
  { id: "P-1042", order: "SO-88291", sku: "SKU-A2B", aisle: "A", bin: "A-B2", qty: 3, eta: "1m 12s" },
  { id: "P-1043", order: "SO-88291", sku: "SKU-C5A", aisle: "C", bin: "C-T5", qty: 1, eta: "2m 04s" },
  { id: "P-1044", order: "SO-88291", sku: "SKU-F1A", aisle: "F", bin: "F-T1", qty: 2, eta: "3m 18s" },
  { id: "P-1045", order: "SO-88292", sku: "SKU-K7B", aisle: "K", bin: "K-B7", qty: 5, eta: "4m 47s" },
  { id: "P-1046", order: "SO-88292", sku: "SKU-H3A", aisle: "H", bin: "H-T3", qty: 1, eta: "5m 33s" },
];

// A demo optimized picking route through selected bins.
// Each point is [x, y] in warehouse coords, threaded through aisles.
export const OPTIMIZED_ROUTE: Array<[number, number]> = [
  [1140, 700], // dock start
  [96, 700],
  [96, 130],  // A aisle top
  [186, 130], // cross to B
  [186, 220],
  [276, 220], // C
  [276, 380],
  [546, 380], // F
  [546, 500],
  [906, 500], // K
  [906, 320],
  [816, 320], // H
  [816, 720],
  [1140, 720], // back to dock
];

export const NAIVE_ROUTE: Array<[number, number]> = [
  [1140, 700],
  [96, 130],
  [1140, 220],
  [96, 380],
  [1140, 500],
  [96, 320],
  [1140, 720],
];

export interface Insight {
  id: string;
  severity: "opportunity" | "warning" | "info";
  title: string;
  detail: string;
  impact: string;
}

export const INSIGHTS: Insight[] = [
  {
    id: "i-1",
    severity: "opportunity",
    title: "Reslot SKU-K7B closer to dock",
    detail: "Picked 412×/day but stored in Aisle K (Zone C). Move to Zone A saves 2.4 mi/day walk.",
    impact: "+18% pick rate",
  },
  {
    id: "i-2",
    severity: "warning",
    title: "Aisle F congestion peaks at 14:00",
    detail: "3 pickers converge in F daily. Stagger wave release by 12 min to smooth flow.",
    impact: "−22% wait time",
  },
  {
    id: "i-3",
    severity: "opportunity",
    title: "Batch pick 74 orders in wave 3",
    detail: "SKU affinity graph shows tight cluster in Zones A/B — batch instead of discrete pick.",
    impact: "+31% throughput",
  },
  {
    id: "i-4",
    severity: "info",
    title: "Automation ROI insufficient at current volume",
    detail: "AS/RS payback = 6.8 yrs at 12K orders/day. Slotting + routing captures 71% of ROI first.",
    impact: "$2.4M deferred capex",
  },
];

export const KPIS = [
  { label: "Pick rate", value: "142", unit: "/ hr", delta: "+18.4%", positive: true },
  { label: "Avg. travel", value: "0.34", unit: "mi / order", delta: "−26%", positive: true },
  { label: "Order accuracy", value: "99.6", unit: "%", delta: "+0.4pt", positive: true },
  { label: "Labor cost", value: "$1.82", unit: "/ order", delta: "−12%", positive: true },
];

export const REPORTS = [
  { id: "r-1", name: "Q3 Slotting Optimization", type: "Slotting", period: "Jul – Sep 2026", generated: "2 days ago", savings: "$184K" },
  { id: "r-2", name: "Peak Season Route Study", type: "Routing", period: "Nov – Dec 2025", generated: "1 week ago", savings: "$312K" },
  { id: "r-3", name: "Automation ROI Benchmark", type: "Capex", period: "Full Year 2026", generated: "2 weeks ago", savings: "$2.4M" },
  { id: "r-4", name: "Labor Flow Simulation", type: "Simulation", period: "Rolling 30d", generated: "1 month ago", savings: "$97K" },
];
