import { useEffect, useRef, useState } from "react";

/**
 * Animated KPI cards row. Values ease from `from` → `to` as `progress` (0..1)
 * advances. Renders four cards: Walking Distance, Pick Time, Labor Cost, Pick Rate.
 */

interface Card {
  label: string;
  from: number;
  to: number;
  unit: string;
  format: (v: number) => string;
  positiveIsDown: boolean; // if true, going down is good (green)
}

const CARDS: Card[] = [
  {
    label: "Walking Distance",
    from: 17.8,
    to: 11.9,
    unit: "km",
    format: (v) => v.toFixed(1),
    positiveIsDown: true,
  },
  {
    label: "Pick Time",
    from: 91,
    to: 58,
    unit: "min",
    format: (v) => Math.round(v).toString(),
    positiveIsDown: true,
  },
  {
    label: "Labor Cost",
    from: 2.18,
    to: 1.74,
    unit: "/ order",
    format: (v) => `$${v.toFixed(2)}`,
    positiveIsDown: true,
  },
  {
    label: "Pick Rate",
    from: 96,
    to: 118,
    unit: "/ hr",
    format: (v) => Math.round(v).toString(),
    positiveIsDown: false,
  },
];

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function OptimizationKpiCards({
  progress,
  active,
}: {
  progress: number;
  active: boolean;
}) {
  const eased = easeInOutCubic(Math.max(0, Math.min(1, progress)));

  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-20 flex -translate-x-1/2 items-stretch gap-2 rounded-2xl border border-border bg-white/95 p-2 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl animate-fade-in">
      {CARDS.map((c) => {
        const cur = c.from + (c.to - c.from) * eased;
        const deltaPct = Math.round(((c.to - c.from) / c.from) * 100);
        const good = c.positiveIsDown ? deltaPct < 0 : deltaPct > 0;
        return (
          <div
            key={c.label}
            className="min-w-[132px] rounded-xl bg-gradient-to-br from-white to-slate-50 px-3 py-2 ring-1 ring-slate-200/70"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {c.label}
              </span>
              {active && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                    good
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {deltaPct > 0 ? "+" : ""}
                  {deltaPct}%
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <TickingValue
                target={cur}
                render={c.format}
                className={`font-display text-[22px] leading-none tabular-nums ${
                  active && good ? "text-emerald-600" : "text-foreground"
                }`}
              />
              <span className="text-[10px] font-medium text-slate-400">{c.unit}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[9.5px] text-slate-400">
              <span className="line-through">{c.format(c.from)}</span>
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <span className={good ? "text-emerald-600" : "text-slate-500"}>
                {c.format(c.to)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Numeric ticker that smooths tiny value changes across frames. */
function TickingValue({
  target,
  render,
  className,
}: {
  target: number;
  render: (v: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(target);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = display;
    const t0 = performance.now();
    const dur = 260;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setDisplay(start + (target - start) * k);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return <span className={className}>{render(display)}</span>;
}
