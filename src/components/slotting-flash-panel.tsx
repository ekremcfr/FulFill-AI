import { useEffect, useState } from "react";

interface Slot {
  sku: string;
  from: string;
  to: string;
  impact: string;
}

const RELOCATIONS: Slot[] = [
  { sku: "SKU-K7B", from: "Aisle K · Zone C", to: "Aisle B · Zone A", impact: "−2.4 mi/day" },
  { sku: "SKU-F1A", from: "Aisle F · Zone B", to: "Aisle C · Zone A", impact: "+9% pick rate" },
  { sku: "SKU-H3A", from: "Aisle H · Zone C", to: "Aisle D · Zone B", impact: "−14% travel" },
];

export function SlottingFlashPanel({ visible }: { visible: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!visible) {
      setShown(0);
      return;
    }
    setShown(0);
    const timers: number[] = [];
    RELOCATIONS.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), 400 + i * 550),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute bottom-32 left-4 z-10 w-[280px] rounded-xl border border-border bg-white/95 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] backdrop-blur animate-fade-in">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15 ring-1 ring-violet-400/40">
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M4 7h10M4 12h16M4 17h8" />
            <path d="M17 4l4 4-4 4M17 20l4-4-4-4" />
          </svg>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-700">Smart Slotting</div>
          <div className="text-[11.5px] font-semibold text-foreground">Relocations recommended</div>
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {RELOCATIONS.map((r, i) => {
          const on = i < shown;
          return (
            <li
              key={r.sku}
              className={`px-3 py-2 transition-all duration-500 ${
                on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-foreground">{r.sku}</span>
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {r.impact}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="line-through">{r.from}</span>
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-slate-400" fill="currentColor">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span className="font-medium text-slate-700">{r.to}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
