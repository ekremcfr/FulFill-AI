import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export type StudyType = "Route Optimization" | "Slotting" | "Labor Analysis" | "Simulation";

export type GeneratedStudy = {
  id: string;
  name: string;
  type: string;
  period: string;
  generated: string;
  savings: string;
  kpis: { label: string; value: string; delta: string }[];
  recommendations: string[];
  reportSummary: string;
};

const WAREHOUSES = ["DC-01 Reno, NV", "DC-02 Memphis, TN", "DC-03 Allentown, PA", "DC-04 Rotterdam, NL"];
const STUDY_TYPES: StudyType[] = ["Route Optimization", "Slotting", "Labor Analysis", "Simulation"];

const AI_STEPS = [
  "Ingesting warehouse telemetry…",
  "Loading SKU velocity + slot maps…",
  "Simulating 12,400 orders across 3 waves…",
  "Running optimization solver (OR-Tools)…",
  "Estimating labor + CO₂ savings…",
  "Generating AI recommendations…",
  "Compiling executive report…",
];

function generateStudy(name: string, warehouse: string, type: StudyType, dateRange: string): GeneratedStudy {
  const seed = (name + warehouse + type).length;
  const rand = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);

  const savingsK = Math.round(80 + rand(60, 340));
  const savings = savingsK > 999 ? `$${(savingsK / 1000).toFixed(1)}M` : `$${savingsK}K`;

  const byType: Record<StudyType, { kpis: GeneratedStudy["kpis"]; recs: string[] }> = {
    "Route Optimization": {
      kpis: [
        { label: "Walking distance", value: "11.9 km", delta: "−33%" },
        { label: "Pick time / order", value: "58 sec", delta: "−36%" },
        { label: "Congestion events", value: "3 / shift", delta: "−72%" },
        { label: "CO₂ reduction", value: "1.8 t / mo", delta: "−28%" },
      ],
      recs: [
        "Batch B-waves into 4-order clusters — cuts travel 18%",
        "Reroute Zone C mid-shift to eliminate cross-aisle conflicts",
        "Pin SKU-145 to A03 (12 picks/hr → 3-sec closer to pack)",
      ],
    },
    "Slotting": {
      kpis: [
        { label: "Golden-zone hit rate", value: "84%", delta: "+22pt" },
        { label: "Reslot moves", value: "1,240", delta: "one-time" },
        { label: "Travel / order", value: "0.24 mi", delta: "−29%" },
        { label: "Replen frequency", value: "4.1 / day", delta: "−17%" },
      ],
      recs: [
        "Move top-40 velocity SKUs to A/B pick face (Zone A rows 1-3)",
        "Consolidate slow-movers into mezzanine — free 380 forward slots",
        "Family-group apparel SKUs — reduces multi-stop picks 24%",
      ],
    },
    "Labor Analysis": {
      kpis: [
        { label: "Labor cost / order", value: "$1.62", delta: "−11%" },
        { label: "Utilization", value: "87%", delta: "+9pt" },
        { label: "Overtime hrs / wk", value: "42", delta: "−58%" },
        { label: "Pick rate", value: "148 / hr", delta: "+19%" },
      ],
      recs: [
        "Shift 6 pickers from Zone D → Zone B during 10am-2pm peak",
        "Cross-train packers on put-wall — covers absentee spikes",
        "Voice-picking pilot in Zone C: +14% rate, 0.9y payback",
      ],
    },
    "Simulation": {
      kpis: [
        { label: "Peak throughput", value: "18.4K / day", delta: "+42%" },
        { label: "Bottleneck (dock 3)", value: "resolved", delta: "−100%" },
        { label: "SLA adherence", value: "99.2%", delta: "+2.1pt" },
        { label: "Capex deferred", value: "$1.1M", delta: "AS/RS defer" },
      ],
      recs: [
        "Add 2 AMRs to Zone B — unlocks 3.2K orders/day headroom",
        "Stagger wave releases every 22 min (vs 15) — smooths pack queue",
        "Defer AS/RS decision 18 months — no capacity gap under simulation",
      ],
    },
  };

  const bucket = byType[type];
  return {
    id: `r-${Date.now()}`,
    name,
    type,
    period: dateRange || "Rolling 30d",
    generated: "just now",
    savings,
    kpis: bucket.kpis,
    recommendations: bucket.recs,
    reportSummary: `${type} study for ${warehouse}. Modeled against 30-day order history (${(8.4 + rand(0.2, 2.1)).toFixed(1)}M lines). Projected annualized savings: ${savings}. Confidence: 92%.`,
  };
}

export function NewStudyModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (s: GeneratedStudy) => void;
}) {
  const [name, setName] = useState("");
  const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
  const [type, setType] = useState<StudyType>("Route Optimization");
  const [dateRange, setDateRange] = useState("Last 30 days");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      setStep(0);
      setName("");
    }
  }, [open]);

  useEffect(() => {
    if (!running) return;
    if (step >= AI_STEPS.length) {
      const study = generateStudy(name || `${type} Study`, warehouse, type, dateRange);
      onComplete(study);
      toast.success("Study completed — added to Reports");
      onClose();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [running, step, name, warehouse, type, dateRange, onClose, onComplete]);

  if (!open) return null;

  const run = () => {
    if (!name.trim()) {
      toast.error("Give your study a name");
      return;
    }
    setRunning(true);
    setStep(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg card-surface p-6 animate-in zoom-in-95 slide-in-from-bottom-4">
        {!running ? (
          <>
            <div className="mb-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-primary">New study</p>
              <h2 className="mt-1 font-display text-2xl text-foreground">Run warehouse study</h2>
              <p className="mt-1 text-sm text-muted-foreground">FulfillAI will simulate and generate a full executive report.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Study name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q4 Slotting Refresh"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Warehouse</label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Study type</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {STUDY_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        type === t
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface text-foreground/80 hover:bg-surface-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  {["Last 7 days", "Last 30 days", "Last 90 days", "Q3 2026", "Q4 2026", "Full year 2026"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground/80 hover:bg-surface-muted">Cancel</button>
              <button onClick={run} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Run study</button>
            </div>
          </>
        ) : (
          <div className="py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-primary">FulfillAI Copilot</p>
                <h3 className="font-display text-lg text-foreground">Running {type.toLowerCase()} study…</h3>
              </div>
            </div>
            <div className="space-y-2">
              {AI_STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                    i < step ? "border-emerald-200 bg-emerald-50/50 text-foreground" :
                    i === step ? "border-primary bg-primary-soft text-primary animate-in fade-in slide-in-from-left-2" :
                    "border-border/50 bg-surface/50 text-muted-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${i < step ? "bg-emerald-500" : i === step ? "bg-primary animate-pulse" : "bg-border"}`} />
                  <span>{s}</span>
                  {i < step && <span className="ml-auto text-[11px] text-emerald-600">✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
