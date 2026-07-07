import { useEffect, useState } from "react";

const STAGES = [
  { label: "Initializing warehouse...", ms: 700 },
  { label: "Loading warehouse layout...", ms: 800 },
  { label: "Loading AI engine...", ms: 850 },
  { label: "Loading SKU history...", ms: 800 },
  { label: "Optimization engine ready.", ms: 700 },
];

const TOTAL = STAGES.reduce((a, s) => a + s.ms, 0);

export function InvestorIntro() {
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  // Only show once per session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fulfillai-intro-seen") === "1") {
      setGone(true);
      return;
    }
    setMounted(true);
    sessionStorage.setItem("fulfillai-intro-seen", "1");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    STAGES.forEach((s, i) => {
      elapsed += s.ms;
      timers.push(setTimeout(() => setStage(i + 1), elapsed - s.ms + 50));
    });
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / TOTAL);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const fadeT = setTimeout(() => setFading(true), TOTAL + 300);
    const goneT = setTimeout(() => setGone(true), TOTAL + 1600);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fadeT);
      clearTimeout(goneT);
      cancelAnimationFrame(raf);
    };
  }, [mounted]);

  if (gone || !mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050914] transition-opacity duration-[1200ms] ease-out ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #0a1a3a 0%, #050914 55%, #02040a 100%)",
      }}
    >
      {/* Ambient scanlines / grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,180,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,255,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      {/* Sweeping AI scan bar */}
      <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
        <div
          className="absolute left-0 right-0 h-40 -translate-y-full"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(120,180,255,0.05) 40%, rgba(180,220,255,0.25) 50%, rgba(120,180,255,0.05) 60%, transparent 100%)",
            animation: "intro-scan 3.2s cubic-bezier(0.65,0,0.35,1) infinite",
          }}
        />
      </div>

      {/* Corner ticks */}
      {[
        "top-6 left-6",
        "top-6 right-6",
        "bottom-6 left-6",
        "bottom-6 right-6",
      ].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} h-10 w-10 opacity-40`}
          style={{
            borderTop: pos.includes("top") ? "1px solid #6ea8ff" : undefined,
            borderBottom: pos.includes("bottom") ? "1px solid #6ea8ff" : undefined,
            borderLeft: pos.includes("left") ? "1px solid #6ea8ff" : undefined,
            borderRight: pos.includes("right") ? "1px solid #6ea8ff" : undefined,
          }}
        />
      ))}

      {/* Top telemetry line */}
      <div className="absolute left-6 right-6 top-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-[#6ea8ff]/70">
        <span>FULFILLAI // BOOT SEQUENCE v4.2</span>
        <span className="tabular-nums">
          {String(Math.floor(progress * 100)).padStart(3, "0")}%
        </span>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-8 text-center">
        {/* Logo mark */}
        <div className="relative mb-6 h-20 w-20">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(120,180,255,0.55) 0%, rgba(120,180,255,0) 70%)",
              animation: "intro-pulse 2.4s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-3 rounded-full border border-[#6ea8ff]/60"
            style={{ animation: "intro-spin 8s linear infinite" }}
          />
          <div className="absolute inset-6 rounded-full border border-[#a8ccff]/80" />
          <div
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dcecff]"
            style={{ boxShadow: "0 0 24px 4px rgba(180,220,255,0.9)" }}
          />
        </div>

        {/* Brand */}
        <h1
          className="font-display text-6xl tracking-tight text-white md:text-7xl"
          style={{
            animation: "intro-rise 900ms cubic-bezier(0.2,0.8,0.2,1) both",
            textShadow: "0 0 40px rgba(120,180,255,0.35)",
          }}
        >
          FulfillAI
        </h1>
        <p
          className="mt-3 font-sans text-sm tracking-[0.35em] text-[#a8ccff] uppercase md:text-base"
          style={{
            animation:
              "intro-rise 1100ms cubic-bezier(0.2,0.8,0.2,1) 200ms both",
          }}
        >
          Every Warehouse Decision, Optimized.
        </p>

        {/* Divider */}
        <div
          className="mt-10 h-px w-64"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(168,204,255,0.6), transparent)",
            animation: "intro-rise 1200ms cubic-bezier(0.2,0.8,0.2,1) 400ms both",
          }}
        />

        {/* Loading stages */}
        <div className="mt-8 h-24 w-full max-w-md">
          <ul className="space-y-1.5 font-mono text-[11px] text-[#a8ccff]/80">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage - 1 && stage < STAGES.length;
              const last = i === STAGES.length - 1 && stage === STAGES.length;
              return (
                <li
                  key={i}
                  className={`flex items-center justify-center gap-2 transition-opacity duration-300 ${
                    i >= stage ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      last
                        ? "bg-emerald-400"
                        : active
                        ? "bg-[#dcecff]"
                        : "bg-[#6ea8ff]"
                    }`}
                    style={
                      active
                        ? { boxShadow: "0 0 10px 2px rgba(180,220,255,0.9)" }
                        : undefined
                    }
                  />
                  <span
                    className={
                      last
                        ? "tracking-widest text-emerald-300"
                        : "tracking-widest"
                    }
                  >
                    {done || active ? s.label : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-px w-80 max-w-full overflow-hidden bg-[#6ea8ff]/15">
          <div
            className="h-full origin-left"
            style={{
              width: `${progress * 100}%`,
              background:
                "linear-gradient(to right, #6ea8ff, #dcecff, #6ea8ff)",
              boxShadow: "0 0 12px rgba(180,220,255,0.7)",
              transition: "width 120ms linear",
            }}
          />
        </div>
      </div>

      {/* Bottom telemetry */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-[#6ea8ff]/60">
        <span>NODE // ORION-3 · 14,208 SKU</span>
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          SECURE LINK
        </span>
      </div>

      <style>{`
        @keyframes intro-scan {
          0% { transform: translateY(-40%); }
          100% { transform: translateY(160vh); }
        }
        @keyframes intro-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.25); opacity: 1; }
        }
        @keyframes intro-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes intro-rise {
          from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
