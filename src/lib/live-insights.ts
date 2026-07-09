export type InsightPriority = "critical" | "high" | "medium" | "low";
export type InsightCategory =
  | "demand"
  | "congestion"
  | "slotting"
  | "batching"
  | "routing"
  | "labor"
  | "inventory";

export interface LiveInsight {
  id: string;
  createdAt: number;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  summary: string;
  businessImpact: string;
  estimatedSavings: string;
  confidence: number; // 0..1
  recommendation: string;
}

let _uid = 0;
const uid = () => `li-${Date.now().toString(36)}-${(_uid++).toString(36)}`;

/**
 * Pool of proactively-generated insights the platform surfaces as warehouse
 * telemetry changes. In production these would be produced by the analytics
 * pipeline; here they simulate a live monitor firing every N seconds.
 */
export function makeInsightPool(): LiveInsight[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      createdAt: now,
      category: "demand",
      priority: "high",
      title: "Today's orders increased by 18%",
      summary:
        "Order intake for Reno DC-04 is trending 18% above the 14-day average, driven by Zone A fast-movers.",
      businessImpact:
        "Wave capacity will saturate around 15:20 without an extra picker on Wave 4.",
      estimatedSavings: "$1,240 / day",
      confidence: 0.94,
      recommendation:
        "Add 1 picker to Wave 4 by 14:45 and pre-stage Zone A totes to hold OTIF.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "congestion",
      priority: "critical",
      title: "Zone C is becoming congested",
      summary:
        "Three pickers are converging on Aisles J–K in Zone C, average dwell time up 46% in the last 20 minutes.",
      businessImpact: "Pick rate in Zone C down 22% vs. shift baseline.",
      estimatedSavings: "$860 / day",
      confidence: 0.88,
      recommendation:
        "Redirect 2 pickers from Aisle J to Aisle L; hold new Zone C releases for 8 min.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "slotting",
      priority: "high",
      title: "SKU-K7B should be relocated to Zone A",
      summary:
        "SKU-K7B is picked 412×/day but stored in Aisle K (Zone C). Reslot to Aisle B (Zone A).",
      businessImpact: "Eliminates 2.4 mi/day of travel across 6 pickers.",
      estimatedSavings: "$1,820 / month",
      confidence: 0.91,
      recommendation:
        "Schedule reslot of SKU-K7B to Bin B12-03 during next overnight replen window.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "batching",
      priority: "medium",
      title: "Batch picking opportunity detected in Wave 3",
      summary:
        "74 orders in Wave 3 share tight SKU affinity across Zones A/B — batch instead of discrete pick.",
      businessImpact: "+31% throughput on Wave 3, −18 min completion time.",
      estimatedSavings: "$2,140 / week",
      confidence: 0.86,
      recommendation:
        "Switch Wave 3 to 8-order batch cartons with sort-to-light at packing station 2.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "routing",
      priority: "high",
      title: "Current optimization could reduce travel distance by 31%",
      summary:
        "Rerouting the active pick path through Aisles A→C→F→H cuts travel from 17.8 km to 11.9 km per wave.",
      businessImpact:
        "38.5 hours/day of labor recovered across the picking team.",
      estimatedSavings: "$1,420 / day",
      confidence: 0.92,
      recommendation:
        "Apply optimized A→C→F→H route to all active waves and lock for the shift.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "labor",
      priority: "medium",
      title: "Stagger Wave 4 release by 12 minutes",
      summary:
        "Aisle F congestion peaks at 14:00. A 12-minute stagger smooths flow across three waves.",
      businessImpact: "−22% picker wait time, +7% orders/hour.",
      estimatedSavings: "$540 / day",
      confidence: 0.83,
      recommendation:
        "Delay Wave 4 release to 14:12 and shift 2 pickers to Aisle F backfill.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "inventory",
      priority: "low",
      title: "SKU-F1A projected stockout in 36 hours",
      summary:
        "Current pick velocity vs. on-hand suggests SKU-F1A depletes Thursday 09:00 without replenishment.",
      businessImpact: "Prevents 62 backorders and preserves OTIF.",
      estimatedSavings: "$310 / incident",
      confidence: 0.78,
      recommendation:
        "Trigger emergency replen PO for SKU-F1A (240 units) before EOD Wednesday.",
    },
    {
      id: uid(),
      createdAt: now,
      category: "congestion",
      priority: "medium",
      title: "Packing station 3 utilization at 94%",
      summary:
        "Packing station 3 is trending toward saturation; rebalance 18 orders to stations 1 and 4.",
      businessImpact: "Prevents 9-minute average dwell at pack-out.",
      estimatedSavings: "$220 / day",
      confidence: 0.81,
      recommendation:
        "Reroute next 18 completed totes to Pack Stations 1 & 4 via WMS override.",
    },
  ];
}

export const PRIORITY_ORDER: Record<InsightPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
