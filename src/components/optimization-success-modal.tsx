import { useEffect, useState } from "react";

interface Metric {
  icon: string; // svg d
  label: string;
  value: string;
  sub?: string;
}

const METRICS: Metric[] = [
  {
    icon: "M4 20l4-4M20 4l-4 4M4 4l16 16",
    label: "Distance Reduction",
    value: "−33%",
    sub: "17.8 → 11.9 km",
  },
  {
    icon: "M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z",
    label: "Time Saved",
    value: "38.5 hrs / day",
    sub: "across picking team",
  },
  {
    icon: "M12 1v22M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6",
    label: "Labor Savings",
    value: "$1,420 / day",
    sub: "$0.44 per order",
  },
  {
    icon: "M3 3v18h18M7 15l4-4 3 3 5-6",
    label: "Est. Annual Savings",
    value: "$518K / yr",
    sub: "at current volume",
  },
  {
    icon: "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7ZM9 20h6",
    label: "CO₂ Reduction",
    value: "−2.4 t / yr",
    sub: "reduced forklift + walk",
  },
];

export function OptimizationSuccessModal({
  open,
  onReplay,
  onClose,
}: {
  open: boolean;
  onReplay: () => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      // slight delay to let the arrival animation settle
      const t = window.setTimeout(() => setVisible(true), 500);
      return () => window.clearTimeout(t);
    }
    setVisible(false);
  }, [open]);

  if (!open || !visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[min(640px,92%)] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_40px_120px_-30px_rgba(15,23,42,0.55)]">
        {/* Header banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.22_0.06_260)] via-[oklch(0.28_0.14_240)] to-[oklch(0.35_0.15_155)] px-7 py-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-14 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/25 ring-1 ring-emerald-300/50">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-200" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-11" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                FulfillAI · Optimization Complete
              </div>
              <div className="font-display text-[22px] leading-tight">
                Warehouse Optimization Complete
              </div>
              <div className="mt-0.5 text-[11.5px] text-white/70">
                Reno DC-04 · Wave 3 · 74 orders · 312 lines picked
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              className="animate-fade-in bg-white p-4"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/25">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </span>
                <span className="text-[9.5px] font-semibold uppercase tracking-widest text-slate-500">
                  {m.label}
                </span>
              </div>
              <div className="mt-1.5 font-display text-[19px] leading-tight text-foreground tabular-nums">
                {m.value}
              </div>
              {m.sub && (
                <div className="mt-0.5 font-mono text-[10px] text-slate-500">{m.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/70 px-6 py-4">
          <div className="text-[11px] text-slate-500">
            All wave orders queued for packing station 2 · confidence{" "}
            <span className="font-mono font-semibold text-emerald-600">94%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Dismiss
            </button>
            <button
              onClick={onReplay}
              className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(16,185,129,0.7)] transition hover:brightness-110"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Replay Optimization
              </span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
