import { INSIGHTS, KPIS, PICK_TASKS, OPTIMIZED_ROUTE, NAIVE_ROUTE } from "@/lib/warehouse-data";

/**
 * Lightweight, client-side snapshot of warehouse context that gets attached
 * (invisibly) to every Copilot message and injected into the system prompt.
 * The user never sees this — it only shapes Gemini's answers.
 */

export interface CopilotContext {
  warehouseName: string;
  todayOrderCount: number;
  currentPickingDistanceMi: number;
  optimizedPickingDistanceMi: number;
  distanceReductionPct: number;
  estimatedTimeSavedHrs: number;
  estimatedLaborSavingsUsd: number;
  selectedWarehouse: string;
  selectedShelf: string | null;
  selectedSku: string | null;
  aiRecommendations: Array<{ title: string; detail: string; impact: string }>;
  heatmapStatus: "on" | "off";
  slottingRecommendations: Array<{ sku: string; from: string; to: string; impact: string }>;
  currentPickingRoute: Array<[number, number]>;
  naivePickingRoute: Array<[number, number]>;
  aiOptimizationResults: Array<{ metric: string; value: string; delta: string }>;
}

// Mutable client state — routes/components update these as the operator interacts.
let selectedWarehouse = "Reno DC-04";
let selectedShelf: string | null = null;
let selectedSku: string | null = null;
let heatmapStatus: "on" | "off" = "on";

export function setSelectedWarehouse(name: string) {
  selectedWarehouse = name;
}
export function setSelectedShelf(id: string | null) {
  selectedShelf = id;
}
export function setSelectedSku(sku: string | null) {
  selectedSku = sku;
}
export function setHeatmapStatus(s: "on" | "off") {
  heatmapStatus = s;
}

const SLOTTING_RECS: CopilotContext["slottingRecommendations"] = [
  { sku: "SKU-K7B", from: "Aisle K (Zone C)", to: "Aisle B (Zone A)", impact: "−2.4 mi/day walk" },
  { sku: "SKU-F1A", from: "Aisle F (Zone B)", to: "Aisle C (Zone A)", impact: "+9% pick rate" },
  { sku: "SKU-H3A", from: "Aisle H (Zone C)", to: "Aisle D (Zone B)", impact: "−14% travel" },
];

export function buildCopilotContext(): CopilotContext {
  const current = 0.46;
  const optimized = 0.34;
  const reduction = Math.round(((current - optimized) / current) * 100);
  return {
    warehouseName: selectedWarehouse,
    todayOrderCount: 12480,
    currentPickingDistanceMi: current,
    optimizedPickingDistanceMi: optimized,
    distanceReductionPct: reduction,
    estimatedTimeSavedHrs: 38.5,
    estimatedLaborSavingsUsd: 1420,
    selectedWarehouse,
    selectedShelf,
    selectedSku,
    aiRecommendations: INSIGHTS.map((i) => ({
      title: i.title,
      detail: i.detail,
      impact: i.impact,
    })),
    heatmapStatus,
    slottingRecommendations: SLOTTING_RECS,
    currentPickingRoute: OPTIMIZED_ROUTE,
    naivePickingRoute: NAIVE_ROUTE,
    aiOptimizationResults: KPIS.map((k) => ({
      metric: k.label,
      value: `${k.value}${k.unit}`,
      delta: k.delta,
    })),
  };
}

export function formatContextForPrompt(ctx: CopilotContext): string {
  const kpiLine = ctx.aiOptimizationResults
    .map((k) => `${k.metric} ${k.value} (${k.delta})`)
    .join(" · ");
  const recs = ctx.aiRecommendations
    .map((r, i) => `  ${i + 1}. ${r.title} — ${r.detail} [${r.impact}]`)
    .join("\n");
  const slotting = ctx.slottingRecommendations
    .map((s, i) => `  ${i + 1}. Move ${s.sku} from ${s.from} → ${s.to} (${s.impact})`)
    .join("\n");
  const pickQueue = PICK_TASKS.slice(0, 5)
    .map((p) => `  - ${p.id} · ${p.sku} · Aisle ${p.aisle} bin ${p.bin} · qty ${p.qty} · ETA ${p.eta}`)
    .join("\n");

  return [
    "LIVE WAREHOUSE CONTEXT (do not repeat verbatim; use to ground answers):",
    `- Warehouse: ${ctx.warehouseName}`,
    `- Selected warehouse: ${ctx.selectedWarehouse}`,
    `- Selected shelf: ${ctx.selectedShelf ?? "none"}`,
    `- Selected SKU: ${ctx.selectedSku ?? "none"}`,
    `- Today's orders: ${ctx.todayOrderCount.toLocaleString()}`,
    `- Current picking distance: ${ctx.currentPickingDistanceMi} mi/order`,
    `- Optimized picking distance: ${ctx.optimizedPickingDistanceMi} mi/order`,
    `- Distance reduction: ${ctx.distanceReductionPct}%`,
    `- Estimated time saved: ${ctx.estimatedTimeSavedHrs} hrs/day`,
    `- Estimated labor savings: $${ctx.estimatedLaborSavingsUsd.toLocaleString()}/day`,
    `- Heatmap: ${ctx.heatmapStatus}`,
    `- AI optimization results: ${kpiLine}`,
    `- Current picking route: ${ctx.currentPickingRoute.length} waypoints (optimized), naive baseline ${ctx.naivePickingRoute.length} waypoints`,
    "- Active pick queue:",
    pickQueue,
    "- Current AI recommendations:",
    recs,
    "- Current slotting recommendations:",
    slotting,
  ].join("\n");
}

