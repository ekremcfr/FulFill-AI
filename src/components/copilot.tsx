import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { askCopilot } from "@/lib/copilot.functions";


/* ============================================================
 * FulfillAI Copilot — floating conversational assistant
 * Scripted, cinematic Q&A tuned for warehouse operations.
 * ==========================================================*/

interface Suggestion {
  action: string;
  improvement: string;
}

interface Msg {
  id: string;
  role: "user" | "ai";
  text: string;
  suggestion?: Suggestion;
  applied?: boolean;
}

interface Script {
  match: RegExp;
  reply: string;
  suggestion?: Suggestion;
}

const SCRIPTS: Script[] = [
  {
    match: /(aisle\s*c|zone\s*c).*(congest|slow|traffic|jam)|why.*c/i,
    reply:
      "Because 42% of today's orders require products stored in C. Pickers are cross-tracking through the same choke point every wave.",
    suggestion: { action: "Move SKU-245 closer to Zone A.", improvement: "+14%" },
  },
  {
    match: /bottleneck|slow.*down|slowest/i,
    reply:
      "The primary bottleneck is the C↔D crossover near packing. Three high-velocity SKUs live on the far side of a low-velocity row, forcing 38% of pickers through it.",
    suggestion: { action: "Re-slot SKU-118 and SKU-402 into Zone A.", improvement: "+19%" },
  },
  {
    match: /(shortest|optim|best).*(route|path)|route.*optim/i,
    reply:
      "Running the optimizer collapses the current 17.8 km tour into an 11.9 km s-curve through zones A→B→C, ending at Packing-1. That's 33 minutes saved per wave.",
    suggestion: { action: "Deploy optimized route to Wave 3.", improvement: "−36% pick time" },
  },
  {
    match: /pack(ing)?.*(load|busy|queue)|packing.*station/i,
    reply:
      "Packing-1 is at 91% utilization, Packing-2 at 47%. Wave sequencing is skewed toward SKUs near Packing-1.",
    suggestion: { action: "Rebalance Wave 4 to Packing-2.", improvement: "+22% throughput" },
  },
  {
    match: /(cold|dead|slow).*sku|obsolete|stale.*stock/i,
    reply:
      "218 SKUs haven't moved in 30+ days and occupy 14% of A-zone real estate — the most valuable slots in the DC.",
    suggestion: { action: "Relocate 41 cold SKUs to overflow rack G.", improvement: "+9% pick density" },
  },
  {
    match: /forecast|demand|next.*(week|day|wave)/i,
    reply:
      "Next 7 days: demand is trending +12% vs. last week, concentrated in Zone A (electronics). Recommend pre-staging Wave 5 & 6 tonight.",
    suggestion: { action: "Pre-stage 340 units to forward-pick.", improvement: "+11% wave velocity" },
  },
  {
    match: /labor|staff|picker|worker/i,
    reply:
      "You are over-staffed by 6 pickers in Zone B and under-staffed by 4 in Zone C between 10:00–14:00. Reassigning saves $1,240 per shift.",
    suggestion: { action: "Rebalance labor plan for tomorrow.", improvement: "−24% labor cost" },
  },
];

const FALLBACK: Script = {
  match: /.*/,
  reply:
    "I can help with congestion, slotting, routing, packing balance, dead stock, forecasting and labor allocation. Try asking why an aisle is slow, or what to re-slot.",
};

const SUGGESTED_PROMPTS = [
  "Why is Aisle C congested?",
  "Where is the biggest bottleneck?",
  "Which SKUs should I re-slot?",
  "How's packing looking?",
];

const GREETING: Msg = {
  id: "greet",
  role: "ai",
  text: "Hi — I'm FulfillAI Copilot. Ask me anything about your warehouse.",
};

export function Copilot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, typing, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    const script = SCRIPTS.find((s) => s.match.test(text)) ?? FALLBACK;
    const delay = 700 + Math.min(1400, script.reply.length * 12);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          text: script.reply,
          suggestion: script.suggestion,
        },
      ]);
    }, delay);
  };

  const apply = (id: string) => {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, applied: true } : x)));
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          text: "Applied. Route planner and slotting model updated in real time. Impact will surface in the next telemetry tick.",
        },
      ]);
    }, 500);
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open FulfillAI Copilot"
        className={`group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_14px_40px_-10px_rgba(16,185,129,0.6)] ring-1 ring-emerald-400/40 transition hover:scale-105 ${
          open ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
        }`}
      >
        <span className="absolute inset-0 rounded-full border border-emerald-300/50 animate-ping" />
        <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="currentColor">
          <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#050914]/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
        style={{ height: "min(620px, calc(100vh - 3rem))" }}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-300" fill="currentColor">
              <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
            </svg>
            <span className="absolute inset-0 rounded-xl border border-emerald-400/40 animate-ping" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight">FulfillAI Copilot</div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Online · Reno DC-04
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-white/60 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.map((m) => (
            <MessageBubble key={m.id} msg={m} onApply={() => apply(m.id)} />
          ))}
          {typing && <TypingBubble />}
        </div>

        {/* Suggested prompts */}
        {msgs.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-4 py-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 transition hover:bg-emerald-500/20"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 border-t border-white/10 bg-black/30 px-3 py-3"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask me anything about your warehouse…"
            className="min-h-[36px] max-h-32 flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-emerald-400/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_6px_18px_-6px_rgba(16,185,129,0.7)] transition hover:brightness-110 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

function MessageBubble({ msg, onApply }: { msg: Msg; onApply: () => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-500 px-3.5 py-2 text-[13px] text-white shadow-[0_4px_20px_-6px_rgba(16,185,129,0.6)]">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="currentColor">
          <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-3.5 py-2 text-[13px] leading-relaxed text-white/90">
          {msg.text}
        </div>
        {msg.suggestion && (
          <div className="overflow-hidden rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06]">
            <div className="px-3.5 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Suggested action
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-white">
                {msg.suggestion.action}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-white/50">Expected improvement</span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono font-semibold text-emerald-300">
                  {msg.suggestion.improvement}
                </span>
              </div>
            </div>
            <button
              onClick={onApply}
              disabled={msg.applied}
              className="flex w-full items-center justify-center gap-1.5 border-t border-emerald-400/20 bg-emerald-500/10 py-2 text-[12px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {msg.applied ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  Applied
                </>
              ) : (
                <>Apply Recommendation</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="currentColor">
          <path d="M12 2l2.4 6.9L21 10l-5.4 4 1.8 7L12 17.3 6.6 21l1.8-7L3 10l6.6-1.1z" />
        </svg>
      </div>
      <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
