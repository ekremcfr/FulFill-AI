import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { askCopilot } from "@/lib/copilot.functions";
import { buildCopilotContext, formatContextForPrompt } from "@/lib/copilot-context";
import type { _RackData as RackData } from "@/components/isometric-warehouse";

/**
 * AI Analysis card rendered below the shelf information panel.
 * Auto-fires a FulfillAI Copilot request whenever the selected shelf changes,
 * with a full shelf-specific context block. Does not replace the existing panel.
 */
export function ShelfAiAnalysis({ rack }: { rack: RackData }) {
  const ask = useServerFn(askCopilot);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(92);

  // Derived shelf context that the user doesn't see
  const distanceToPackingM = estimateDistanceToPackingM(rack);
  const inventoryPct = Math.round((rack.inventory / rack.capacity) * 100);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText("");
    // Small deterministic confidence per shelf, weighted by demand
    const base =
      rack.demand === "High" ? 94 : rack.demand === "Medium" ? 88 : 82;
    const jitter = (rack.freq % 6) - 3;
    setConfidence(Math.max(70, Math.min(98, base + jitter)));

    (async () => {
      try {
        const globalContext = formatContextForPrompt(buildCopilotContext());
        const shelfContext = [
          "SELECTED SHELF CONTEXT:",
          `- Shelf ID: ${rack.id}`,
          `- Warehouse Zone: Zone ${rack.zone}`,
          `- Aisle / Row / Slot: Aisle ${rack.aisle} · Row ${rack.row} · Slot ${rack.slot + 1}`,
          `- Current SKU: ${rack.sku} (${rack.productName})`,
          `- Demand Level: ${rack.demand}`,
          `- Inventory Level: ${rack.inventory} / ${rack.capacity} units (${inventoryPct}%)`,
          `- Distance to Packing Station: ~${distanceToPackingM} m`,
          `- Daily Picking Frequency: ${rack.freq} picks/day (avg ${rack.avgDaily})`,
          `- Current Optimization Recommendation: ${rack.rec}`,
        ].join("\n");

        const prompt = `A warehouse manager has just selected shelf ${rack.id}. Produce a shelf-specific analysis using the required 4-section format (Summary / Reasoning / Business Impact / Recommendation). Reference the shelf's zone, SKU, demand, inventory, packing-station distance, and picking frequency where relevant. Be concise and quantify impact.`;

        const res = await ask({
          data: {
            messages: [{ role: "user", text: prompt }],
            contextText: `${globalContext}\n\n${shelfContext}`,
          },
        });
        if (cancelled) return;
        if (res.ok) {
          setText(res.text);
        } else {
          console.error("[shelf-ai] gemini failed", res);
          setError(
            [
              `Status: ${res.status} ${res.statusText || ""}`.trim(),
              res.providerMessage ? `Message: ${res.providerMessage}` : "",
              res.body ? `Body: ${res.body}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[shelf-ai] request failed", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack.id]);

  return (
    <div
      key={rack.id}
      className="animate-fade-in border-t border-border bg-gradient-to-b from-emerald-50/50 to-transparent"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15">
            <span className="absolute inset-0 animate-ping rounded-md bg-emerald-500/30" />
            <svg viewBox="0 0 24 24" className="relative h-3 w-3 text-emerald-600" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
          </span>
          <h3 className="text-[13px] font-semibold text-foreground">
            FulfillAI Analysis
          </h3>
        </div>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
          {loading ? "Analyzing…" : "Ready"}
        </span>
      </div>

      <div className="px-4 pt-2 pb-4">
        {loading && (
          <div className="animate-scale-in space-y-2">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "300ms" }} />
              <span>Analyzing shelf {rack.id}…</span>
            </div>
            <div className="h-2 w-full animate-pulse rounded bg-emerald-100" />
            <div className="h-2 w-11/12 animate-pulse rounded bg-emerald-100" />
            <div className="h-2 w-9/12 animate-pulse rounded bg-emerald-100" />
          </div>
        )}

        {error && !loading && (
          <pre className="animate-fade-in whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
            {error}
          </pre>
        )}

        {!loading && !error && text && (
          <div className="animate-fade-in space-y-3">
            <div className="whitespace-pre-wrap rounded-lg border border-emerald-200/70 bg-white/80 p-3 text-[12px] leading-relaxed text-foreground shadow-sm">
              {text}
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Confidence Score</span>
                <span className="font-mono text-[11px] text-foreground">{confidence}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    confidence >= 90
                      ? "bg-emerald-500"
                      : confidence >= 80
                        ? "bg-blue-500"
                        : "bg-amber-500"
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Rough estimate: packing stations sit near the dock (right side, x ≈ 1140).
// Convert warehouse coords to meters (~0.1 m per unit).
function estimateDistanceToPackingM(rack: RackData): number {
  const packX = 1140;
  const packY = 700;
  const dx = packX - rack.x;
  const dy = packY - rack.y;
  const units = Math.sqrt(dx * dx + dy * dy);
  return Math.round(units * 0.1);
}
