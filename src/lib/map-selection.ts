import type { _RackData as RackData } from "@/components/isometric-warehouse";

export type MapSelection =
  | { kind: "shelf"; rack: RackData }
  | { kind: "zone"; zone: "A" | "B" | "C" }
  | { kind: "worker"; workerId: string }
  | { kind: "order"; orderId: string; sku: string; aisle: string; qty: number }
  | { kind: "route"; label: string };

export interface SelectionPromptParts {
  title: string;
  contextBlock: string;
  askPrompt: string;
}

export function describeSelection(sel: MapSelection): SelectionPromptParts {
  switch (sel.kind) {
    case "shelf": {
      const r = sel.rack;
      const pct = Math.round((r.inventory / r.capacity) * 100);
      return {
        title: `Shelf ${r.id}`,
        contextBlock: [
          "SELECTED SHELF:",
          `- Shelf ID: ${r.id}`,
          `- Zone: ${r.zone} · Aisle ${r.aisle} · Row ${r.row} · Slot ${r.slot + 1}`,
          `- SKU: ${r.sku} (${r.productName})`,
          `- Demand: ${r.demand} · Daily picks: ${r.freq}`,
          `- Inventory: ${r.inventory}/${r.capacity} (${pct}%)`,
          `- Current recommendation: ${r.rec}`,
        ].join("\n"),
        askPrompt: `The manager just selected shelf ${r.id}. Explain in the 4-section format why this location matters, its operational impact, current efficiency, possible improvements, and quantified KPI upside.`,
      };
    }
    case "zone":
      return {
        title: `Zone ${sel.zone}`,
        contextBlock: [
          "SELECTED ZONE:",
          `- Zone: ${sel.zone}`,
          `- Classification: ${sel.zone === "A" ? "Fast-mover (near dock)" : sel.zone === "B" ? "Mid-velocity" : "Slow-mover (far)"}`,
        ].join("\n"),
        askPrompt: `The manager just selected warehouse Zone ${sel.zone}. Explain in the 4-section format why this zone matters, current efficiency, congestion/utilization signals, possible improvements, and quantified KPI upside (throughput, travel, labor).`,
      };
    case "worker":
      return {
        title: `Picker ${sel.workerId}`,
        contextBlock: [
          "SELECTED WORKER:",
          `- Worker ID: ${sel.workerId}`,
          `- Current activity: executing optimized pick route`,
        ].join("\n"),
        askPrompt: `The manager just selected picker ${sel.workerId} on the floor. Explain in the 4-section format the worker's role in current operations, productivity signals, efficiency vs. team baseline, coaching or routing improvements, and quantified labor/throughput impact.`,
      };
    case "order":
      return {
        title: `Order ${sel.orderId}`,
        contextBlock: [
          "SELECTED ORDER:",
          `- Order ID: ${sel.orderId}`,
          `- Line SKU: ${sel.sku} · Aisle ${sel.aisle} · Qty ${sel.qty}`,
        ].join("\n"),
        askPrompt: `The manager just selected order ${sel.orderId}. Explain in the 4-section format the order's fulfillment path, batching or wave opportunities, risk (cutoff, SLA, distance), and quantified impact on cycle time and labor.`,
      };
    case "route":
      return {
        title: sel.label,
        contextBlock: [
          "SELECTED PICKING ROUTE:",
          `- Route: ${sel.label}`,
          `- Type: AI-optimized traversal across Zones A/B/C`,
        ].join("\n"),
        askPrompt: `The manager just selected the current picking route (${sel.label}). Explain in the 4-section format why this route matters, its efficiency vs. naive S-shape routing, possible refinements, and quantified travel/labor savings.`,
      };
  }
}

export function selectionKey(sel: MapSelection): string {
  switch (sel.kind) {
    case "shelf": return `shelf:${sel.rack.id}`;
    case "zone": return `zone:${sel.zone}`;
    case "worker": return `worker:${sel.workerId}`;
    case "order": return `order:${sel.orderId}`;
    case "route": return `route:${sel.label}`;
  }
}
