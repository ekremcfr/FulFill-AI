import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { askCopilot } from "@/lib/copilot.functions";
import { buildCopilotContext, formatContextForPrompt } from "@/lib/copilot-context";
import { onOptimizationComplete } from "@/lib/optimization-events";



/* ============================================================
 * FulfillAI Copilot — floating conversational assistant
 * Scripted, cinematic Q&A tuned for warehouse operations.
 * ==========================================================*/

interface Suggestion {
  action: string;
  improvement: string;
}

interface ConciseCard {
  summary: string;
  businessImpact: string;
  recommendation: string;
  confidence: number; // 0..1
}

interface Msg {
  id: string;
  role: "user" | "ai";
  text: string;
  card?: ConciseCard;
  detailed?: string;
  loadingDetailed?: boolean;
  suggestion?: Suggestion;
  applied?: boolean;
}

function parseCard(raw: string): ConciseCard | null {
  const trimmed = raw.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const j = JSON.parse(trimmed);
    if (
      typeof j?.summary === "string" &&
      typeof j?.businessImpact === "string" &&
      typeof j?.recommendation === "string"
    ) {
      const c = typeof j.confidence === "number" ? j.confidence : 0.85;
      return {
        summary: j.summary,
        businessImpact: j.businessImpact,
        recommendation: j.recommendation,
        confidence: Math.max(0, Math.min(1, c)),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}




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
  const ask = useServerFn(askCopilot);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, typing, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Optimization run → auto-open and stream an executive summary
  useEffect(() => {
    return onOptimizationComplete(() => {
      setOpen(true);
      const userMsg: Msg = {
        id: `u-opt-${Date.now()}`,
        role: "user",
        text: "Optimization run just completed — give me the executive summary.",
      };
      setMsgs((m) => [...m, userMsg]);
      setTyping(true);
      (async () => {
        try {
          const contextText = formatContextForPrompt(buildCopilotContext());
          const prompt = `The warehouse optimizer just finished a full run on Reno DC-04.

Results:
- Travel distance: 17.8 km → 11.9 km (−33%)
- Pick time: 91 min → 58 min (−36%)
- Labor cost: −24% per order
- Pick rate: 96/hr → 142/hr (+48%)
- CO₂ per wave: −29%

Newly generated AI insights:
1. Congestion eliminated in Zone C — rerouted 3 pickers, dwell time back to baseline.
2. Batch picking opportunity detected — 74 Wave-3 orders share SKU affinity across Zones A/B.
3. SKU-145 relocated to Shelf A03 — high-velocity SKU moved closer to packing.

Write a decisive executive summary for the ops director. Keep it concise.`;
          const result = await ask({
            data: {
              messages: [{ role: "user", text: prompt }],
              contextText,
              mode: "concise",
            },
          });
          setTyping(false);
          if (result.ok) {
            const card = parseCard(result.text);
            setMsgs((m) => [
              ...m,
              { id: `a-opt-${Date.now()}`, role: "ai", text: card ? "" : result.text, card: card ?? undefined },
            ]);
          } else {
            setMsgs((m) => [
              ...m,
              {
                id: `a-opt-${Date.now()}`,
                role: "ai",
                text: `Couldn't reach the summary engine: ${result.error}`,
              },
            ]);
          }
        } catch (err) {
          setTyping(false);
          const message = err instanceof Error ? err.message : String(err);
          setMsgs((m) => [
            ...m,
            { id: `a-opt-${Date.now()}`, role: "ai", text: `Executive summary failed.\n\n${message}` },
          ]);
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    const history: Msg[] = [...msgs, userMsg];
    setMsgs(history);
    setInput("");
    setTyping(true);

    try {
      const contextText = formatContextForPrompt(buildCopilotContext());
      const result = await ask({
        data: {
          messages: history
            .filter((m) => m.id !== "greet")
            .map((m) => ({ role: m.role, text: m.text })),
          contextText,
        },
      });
      setTyping(false);
      if (result.ok) {
        setMsgs((m) => [
          ...m,
          { id: `a-${Date.now()}`, role: "ai", text: result.text },
        ]);
      } else {
        console.error("[copilot] gemini request failed", result);
        const details = [
          `Status: ${result.status} ${result.statusText || ""}`.trim(),
          result.providerMessage ? `Message: ${result.providerMessage}` : "",
          result.body ? `Response body:\n${result.body}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        setMsgs((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            text: `${result.error}\n\n${details}`.trim(),
          },
        ]);
      }
    } catch (err) {
      console.error("[copilot] send failed", err);
      setTyping(false);
      const message = err instanceof Error ? err.message : String(err);
      setMsgs((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          text: `Copilot request failed on the client.\n\n${message}`,
        },
      ]);
    }
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
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-white/[0.06] px-3.5 py-2 text-[13px] leading-relaxed text-white/90">
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
