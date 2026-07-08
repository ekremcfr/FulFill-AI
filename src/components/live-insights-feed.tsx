import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { askCopilot } from "@/lib/copilot.functions";
import { buildCopilotContext, formatContextForPrompt } from "@/lib/copilot-context";
import {
  makeInsightPool,
  PRIORITY_ORDER,
  type LiveInsight,
  type InsightPriority,
  type InsightCategory,
} from "@/lib/live-insights";
import { onOptimizationComplete } from "@/lib/optimization-events";

const REFRESH_MS = 15000;
const MAX_VISIBLE = 6;

export function LiveInsightsFeed() {
  const pool = useMemo(() => makeInsightPool(), []);
  const [visible, setVisible] = useState<LiveInsight[]>(() =>
    [...pool].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).slice(0, MAX_VISIBLE),
  );
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [active, setActive] = useState<LiveInsight | null>(null);
  const cursor = useRef(MAX_VISIBLE % pool.length);

  // Proactive monitor: rotate a fresh insight in every REFRESH_MS to simulate
  // live warehouse telemetry firing new detections.
  useEffect(() => {
    const t = setInterval(() => {
      const next = pool[cursor.current % pool.length];
      cursor.current += 1;
      const fresh: LiveInsight = { ...next, id: `${next.id}-${cursor.current}`, createdAt: Date.now() };
      setVisible((prev) => [fresh, ...prev].slice(0, MAX_VISIBLE));
      setPulseId(fresh.id);
      setTimeout(() => setPulseId((p) => (p === fresh.id ? null : p)), 1600);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [pool]);

  // Optimization run → immediately prepend three new AI insights
  useEffect(() => {
    return onOptimizationComplete(() => {
      const now = Date.now();
      const seed = Math.random().toString(36).slice(2, 6);
      const fresh: LiveInsight[] = [
        {
          id: `opt-congestion-${seed}`,
          createdAt: now,
          category: "congestion",
          priority: "high",
          title: "Congestion eliminated in Zone C",
          summary:
            "Rerouted 3 pickers away from Aisles J–K bottleneck; average dwell time back to shift baseline.",
          businessImpact: "Zone C pick rate recovered to +6% above baseline.",
          estimatedSavings: "$860 / day",
          confidence: 0.93,
        },
        {
          id: `opt-batching-${seed}`,
          createdAt: now + 1,
          category: "batching",
          priority: "high",
          title: "Batch picking opportunity detected",
          summary:
            "74 Wave-3 orders share tight SKU affinity across Zones A/B — batch-pick recommended over discrete.",
          businessImpact: "+31% throughput on Wave 3, −18 min completion time.",
          estimatedSavings: "$2,140 / week",
          confidence: 0.9,
        },
        {
          id: `opt-slot-${seed}`,
          createdAt: now + 2,
          category: "slotting",
          priority: "medium",
          title: "SKU-145 relocated to Shelf A03",
          summary:
            "High-velocity SKU-145 moved from Zone C to Shelf A03 (Zone A) — closer to packing station.",
          businessImpact: "Eliminates ≈420 m/day of picker travel.",
          estimatedSavings: "$1,820 / month",
          confidence: 0.94,
        },
      ];
      setVisible((prev) => [...fresh, ...prev].slice(0, MAX_VISIBLE));
      setPulseId(fresh[0].id);
      setTimeout(() => setPulseId(null), 2200);
    });
  }, []);

  return (
    <>
      <div className="card-surface flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15">
                <span className="absolute inset-0 animate-ping rounded-md bg-emerald-500/30" />
                <svg viewBox="0 0 24 24" className="relative h-3 w-3 text-emerald-600" fill="currentColor">
                  <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
                </svg>
              </span>
              <h2 className="text-sm font-semibold text-foreground">Live AI Insights</h2>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              FulfillAI monitor · auto-refresh {Math.round(REFRESH_MS / 1000)}s
            </p>
          </div>
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
            {visible.length} active
          </span>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {visible.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => setActive(it)}
                className={`group flex w-full flex-col gap-2 p-4 text-left transition hover:bg-surface-muted/60 ${
                  pulseId === it.id ? "bg-emerald-50/70" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <CategoryIcon category={it.category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {it.title}
                      </p>
                      <PriorityBadge priority={it.priority} />
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {it.summary}
                    </p>
                  </div>
                </div>
                <div className="ml-8 grid grid-cols-3 gap-2">
                  <MetaCell label="Impact" value={it.businessImpact} tone="foreground" />
                  <MetaCell label="Savings" value={it.estimatedSavings} tone="emerald" />
                  <ConfidenceCell value={it.confidence} />
                </div>
                <div className="ml-8 flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
                  Click for AI explanation
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {active && <InsightDetailModal insight={active} onClose={() => setActive(null)} />}
    </>
  );
}

function PriorityBadge({ priority }: { priority: InsightPriority }) {
  const styles: Record<InsightPriority, string> = {
    critical: "bg-red-100 text-red-700 ring-1 ring-red-200",
    high: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    medium: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  };
  return (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function MetaCell({ label, value, tone }: { label: string; value: string; tone: "foreground" | "emerald" }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[11px] font-semibold leading-tight ${tone === "emerald" ? "text-emerald-700" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceCell({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-md border border-border bg-surface-muted/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Confidence</div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-semibold text-foreground">{pct}%</span>
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: InsightCategory }) {
  const map: Record<InsightCategory, { bg: string; fg: string; label: string }> = {
    demand: { bg: "bg-blue-100", fg: "text-blue-700", label: "▲" },
    congestion: { bg: "bg-red-100", fg: "text-red-700", label: "⚠" },
    slotting: { bg: "bg-emerald-100", fg: "text-emerald-700", label: "↔" },
    batching: { bg: "bg-violet-100", fg: "text-violet-700", label: "∷" },
    routing: { bg: "bg-cyan-100", fg: "text-cyan-700", label: "↗" },
    labor: { bg: "bg-amber-100", fg: "text-amber-800", label: "⏱" },
    inventory: { bg: "bg-slate-100", fg: "text-slate-700", label: "▣" },
  };
  const s = map[category];
  return (
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-bold leading-none ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

/* ============================================================
 * Detail modal — asks FulfillAI Copilot for a full explanation
 * ==========================================================*/
function InsightDetailModal({ insight, onClose }: { insight: LiveInsight; onClose: () => void }) {
  const ask = useServerFn(askCopilot);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setText("");
      try {
        const contextText = formatContextForPrompt(buildCopilotContext());
        const prompt = `Explain the following live insight in detail. Follow the required 4-section format (Summary / Reasoning / Business Impact / Recommendation).

Insight:
- Title: ${insight.title}
- Category: ${insight.category}
- Priority: ${insight.priority}
- Summary: ${insight.summary}
- Business Impact (headline): ${insight.businessImpact}
- Estimated Savings: ${insight.estimatedSavings}
- Confidence: ${Math.round(insight.confidence * 100)}%`;
        const res = await ask({
          data: {
            messages: [{ role: "user", text: prompt }],
            contextText,
          },
        });
        if (cancelled) return;
        if (res.ok) {
          setText(res.text);
        } else {
          console.error("[live-insights] gemini failed", res);
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
        console.error("[live-insights] request failed", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [insight, ask]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={insight.priority} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                FulfillAI Copilot · deep analysis
              </span>
            </div>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground">
              {insight.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-border bg-surface-muted/30 px-5 py-3">
          <MetaCell label="Impact" value={insight.businessImpact} tone="foreground" />
          <MetaCell label="Savings" value={insight.estimatedSavings} tone="emerald" />
          <ConfidenceCell value={insight.confidence} />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-foreground">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "300ms" }} />
              <span className="ml-2 text-[12px]">FulfillAI Copilot is analyzing…</span>
            </div>
          )}
          {error && (
            <pre className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
              {error}
            </pre>
          )}
          {!loading && !error && (
            <div className="whitespace-pre-wrap">{text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
