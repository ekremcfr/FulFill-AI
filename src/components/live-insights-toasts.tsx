import { useEffect, useState } from "react";

interface InsightItem {
  title: string;
  detail: string;
  tone: "emerald" | "blue" | "violet" | "amber";
  icon: "check" | "route" | "bolt" | "users";
}

const INSIGHTS: InsightItem[] = [
  {
    title: "Congestion eliminated in Zone C",
    detail: "Rerouted 2 pickers away from Aisle J — dwell time down 46%.",
    tone: "emerald",
    icon: "check",
  },
  {
    title: "31% travel reduction achieved",
    detail: "Optimized A→C→F→H path saves 5.9 km per wave.",
    tone: "blue",
    icon: "route",
  },
  {
    title: "Batch picking opportunity identified",
    detail: "74 orders in Wave 3 share SKU affinity — +31% throughput.",
    tone: "violet",
    icon: "bolt",
  },
  {
    title: "High-demand SKU relocated",
    detail: "SKU-K7B moved to Aisle B (Zone A) — 412 picks/day now front-of-house.",
    tone: "amber",
    icon: "bolt",
  },
  {
    title: "Labor utilization improved",
    detail: "Wave 4 staggered 12 min — picker wait time −22%, +7% orders/hr.",
    tone: "emerald",
    icon: "users",
  },
];

const TONE: Record<InsightItem["tone"], { bg: string; ring: string; text: string; dot: string }> = {
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  blue: { bg: "bg-blue-50", ring: "ring-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  violet: { bg: "bg-violet-50", ring: "ring-violet-200", text: "text-violet-700", dot: "bg-violet-500" },
  amber: { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
};

function Icon({ kind }: { kind: InsightItem["icon"] }) {
  const p = {
    check: "M5 12l5 5 9-11",
    route: "M4 20l4-4M20 4l-4 4M4 4l16 16",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8Z",
    users: "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M21 20v-2a4 4 0 0 0-3-3.9M15 4.1a4 4 0 0 1 0 7.8M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  }[kind];
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={kind === "bolt" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

export function LiveInsightsToasts({ trigger }: { trigger: number }) {
  // `trigger` increments each time the optimizer runs — resets & replays the stack.
  const [shown, setShown] = useState<number>(0);

  useEffect(() => {
    if (trigger === 0) {
      setShown(0);
      return;
    }
    setShown(0);
    const timers: number[] = [];
    INSIGHTS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), 800 + i * 900));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [trigger]);

  if (trigger === 0) return null;
  return (
    <div className="pointer-events-none absolute right-4 top-24 z-20 flex w-[280px] flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-border bg-white/95 px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live AI Insights
        </span>
        <span className="font-mono text-slate-400">{shown}/{INSIGHTS.length}</span>
      </div>
      {INSIGHTS.slice(0, shown).map((it, i) => {
        const tone = TONE[it.tone];
        return (
          <div
            key={i}
            className={`rounded-xl border bg-white/95 p-2.5 shadow-lg backdrop-blur transition ring-1 ${tone.ring} animate-fade-in`}
          >
            <div className="flex items-start gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}>
                <Icon kind={it.icon} />
              </span>
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold text-foreground">{it.title}</div>
                <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{it.detail}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
