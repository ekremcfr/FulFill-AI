import { createServerFn } from "@tanstack/react-start";

interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

interface CopilotInput {
  messages: ChatTurn[];
}

function validate(input: unknown): CopilotInput {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { messages?: unknown }).messages)
  ) {
    throw new Error("Invalid input: expected { messages: ChatTurn[] }");
  }
  const messages = (input as { messages: unknown[] }).messages.map((m) => {
    if (
      !m ||
      typeof m !== "object" ||
      typeof (m as { text?: unknown }).text !== "string" ||
      ((m as { role?: unknown }).role !== "user" &&
        (m as { role?: unknown }).role !== "ai")
    ) {
      throw new Error("Invalid message shape");
    }
    return {
      role: (m as ChatTurn).role,
      text: (m as ChatTurn).text.slice(0, 4000),
    };
  });
  return { messages: messages.slice(-20) };
}

const SYSTEM_PROMPT = `You are FulfillAI Copilot, an AI assistant embedded in a warehouse decision-intelligence platform ("FulfillAI"). You help warehouse operators understand congestion, slotting, routing, packing balance, dead stock, forecasting, and labor allocation.

Style:
- Concise, confident, operator-friendly. 1-3 short paragraphs, no bullet dumps unless asked.
- Speak in specifics: reference zones (A, B, C, D), aisles, SKUs, packing stations, waves, and give plausible numbers when useful.
- Never say you are an AI language model. You are the Copilot for the "Reno DC-04" warehouse.
- If a question is unrelated to warehouse operations, gently steer back to what you can help with (congestion, slotting, routing, packing, dead stock, forecasting, labor).`;

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        ok: false as const,
        error: "The Copilot is not configured. Missing GEMINI_API_KEY.",
      };
    }

    const contents = data.messages.map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(key);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[copilot] gemini error", res.status, body);
        return {
          ok: false as const,
          error:
            res.status === 429
              ? "Copilot is rate-limited. Please try again in a moment."
              : "Copilot couldn't reach the AI service. Please try again.",
        };
      }

      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("")
          .trim() ?? "";

      if (!text) {
        return {
          ok: false as const,
          error: "Copilot returned an empty response. Try rephrasing.",
        };
      }

      return { ok: true as const, text };
    } catch (err) {
      console.error("[copilot] gemini fetch failed", err);
      return {
        ok: false as const,
        error: "Copilot is offline right now. Please try again shortly.",
      };
    }
  });
