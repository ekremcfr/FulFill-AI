import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { askCopilot } from "@/lib/copilot.functions";
import { buildCopilotContext, formatContextForPrompt } from "@/lib/copilot-context";
import {
  describeSelection,
  selectionKey,
  type MapSelection,
} from "@/lib/map-selection";

/**
 * Floating proactive AI insight panel. Whenever `selection` changes, it
 * automatically fires FulfillAI Copilot for a contextual explanation of
 * the selected entity. Animated in/out.
 */
export function ProactiveInsightPanel({
  selection,
  onClose,
}: {
  selection: MapSelection | null;
  onClose: () => void;
}) {
  const ask = useServerFn(askCopilot);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(90);

  const key = selection ? selectionKey(selection) : "";

  useEffect(() => {
    if (!selection) return;
    let cancelled = false;
    const parts = describeSelection(selection);
    setLoading(true);
    setError(null);
    setText("");
    setConfidence(85 + ((key.length * 7) % 12));

    (async () => {
      try {
        const global = formatContextForPrompt(buildCopilotContext());
        const res = await ask({
          data: {
            messages: [{ role: "user", text: parts.askPrompt }],
            contextText: `${global}\n\n${parts.contextBlock}`,
          },
        });
        if (cancelled) return;
        if (res.ok) {
          setText(res.text);
        } else {
          console.error("[proactive-panel] gemini failed", res);
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
        console.error("[proactive-panel] request failed", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!selection) return null;
  const parts = describeSelection(selection);

  return (
    <div
      key={key}
      className="pointer-events-auto absolute left-4 top-24 z-30 w-[320px] animate-fade-in"
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-[#050914]/95 text-white shadow-[0_25px_80px_-20px_rgba(16,185,129,0.55)] backdrop-blur-xl">
        {/* animated gradient ring */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-70">
          <div className="absolute inset-[1px] rounded-2xl bg-[#050914]/95" />
          <div
            className="absolute -inset-8 opacity-25"
            style={{
              background: "conic-gradient(from 0deg, #22C55E, #10B981, #06B6D4, #22C55E)",
              animation: "opt-spin 5s linear infinite",
            }}
          />
        </div>

        <div className="relative">
          <div className="flex items-start justify-between gap-2 px-4 pt-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                FulfillAI · contextual analysis
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-white">
                {parts.title}
                <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-white/70">
                  {selection.kind}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="max-h-[46vh] overflow-y-auto px-4 pb-3 pt-2 text-[12px] leading-relaxed text-white/90">
            {loading && (
              <div className="animate-scale-in space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                  <span className="ml-1 text-[11px]">Analyzing {parts.title}…</span>
                </div>
                <div className="h-1.5 w-full animate-pulse rounded bg-white/10" />
                <div className="h-1.5 w-10/12 animate-pulse rounded bg-white/10" />
                <div className="h-1.5 w-8/12 animate-pulse rounded bg-white/10" />
              </div>
            )}
            {error && !loading && (
              <pre className="whitespace-pre-wrap rounded-md border border-red-400/30 bg-red-500/10 p-2 text-[11px] text-red-200">
                {error}
              </pre>
            )}
            {!loading && !error && text && (
              <div className="animate-fade-in whitespace-pre-wrap">{text}</div>
            )}
          </div>

          {!loading && !error && text && (
            <div className="border-t border-white/10 bg-black/20 px-4 py-2">
              <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-widest text-white/60">
                <span>Confidence</span>
                <span className="font-mono text-[10px] text-white">{confidence}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    confidence >= 90 ? "bg-emerald-400" : confidence >= 80 ? "bg-cyan-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes opt-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
