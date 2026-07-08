import { INSIGHTS, KPIS } from "@/lib/warehouse-data";

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
  estimatedTimeSavedHrs: number;
  estimatedLaborSavingsUsd: number;
  selectedWarehouse: string;
  selectedShelf: string | null;
  aiRecommendations: Array<{ title: string; detail: string; impact: string }>;
  heatmapStatus: "on" | "off";
  slottingRecommendations: Array<{ sku: string; from: string; to: string; impact: string }>;
}

// Mutable client state — routes/components update these as the operator interacts.
let selectedWarehouse = "Reno DC-04";
let selectedShelf: string | null = null;
let heatmapStatus: "on" | "off" = "on";

export function setSelectedWarehouse(name: string) {
  selectedWarehouse = name;
}
export function setSelectedShelf(id: string | null) {
  selectedShelf = id;
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
  return {
    warehouseName: selectedWarehouse,
    todayOrderCount: 12480,
    currentPickingDistanceMi: 0.46,
    optimizedPickingDistanceMi: 0.34,
    estimatedTimeSavedHrs: 38.5,
    estimatedLaborSavingsUsd: 1420,
    selectedWarehouse,
    selectedShelf,
    aiRecommendations: INSIGHTS.map((i) => ({
      title: i.title,
      detail: i.detail,
      impact: i.impact,
    })),
    heatmapStatus,
    slottingRecommendations: SLOTTING_RECS,
  };
}

export function formatContextForPrompt(ctx: CopilotContext): string {
  const kpiLine = KPIS.map((k) => `${k.label} ${k.value}${k.unit} (${k.delta})`).join(" · ");
  const recs = ctx.aiRecommendations
    .map((r, i) => `  ${i + 1}. ${r.title} — ${r.detail} [${r.impact}]`)
    .join("\n");
  const slotting = ctx.slottingRecommendations
    .map((s, i) => `  ${i + 1}. Move ${s.sku} from ${s.from} → ${s.to} (${s.impact})`)
    .join("\n");

  return [
    "LIVE WAREHOUSE CONTEXT (do not repeat verbatim; use to ground answers):",
    `- Warehouse: ${ctx.warehouseName}`,
    `- Selected warehouse: ${ctx.selectedWarehouse}`,
    `- Selected shelf: ${ctx.selectedShelf ?? "none"}`,
    `- Today's orders: ${ctx.todayOrderCount.toLocaleString()}`,
    `- Current picking distance: ${ctx.currentPickingDistanceMi} mi/order`,
    `- Optimized picking distance: ${ctx.optimizedPickingDistanceMi} mi/order`,
    `- Estimated time saved: ${ctx.estimatedTimeSavedHrs} hrs/day`,
    `- Estimated labor savings: $${ctx.estimatedLaborSavingsUsd.toLocaleString()}/day`,
    `- Heatmap: ${ctx.heatmapStatus}`,
    `- KPIs: ${kpiLine}`,
    "- Current AI recommendations:",
    recs,
    "- Slotting recommendations:",
    slotting,
  ].join("\n");
}
