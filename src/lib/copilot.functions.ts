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

      const raw = await res.text();

      if (!res.ok) {
        console.error("[copilot] gemini error", res.status, raw);
        let providerMessage = "";
        try {
          const parsed = JSON.parse(raw) as {
            error?: { message?: string; status?: string };
          };
          providerMessage = parsed.error?.message ?? "";
        } catch {
          /* not JSON */
        }
        return {
          ok: false as const,
          status: res.status,
          statusText: res.statusText,
          providerMessage,
          body: raw.slice(0, 4000),
          error: `Gemini API returned ${res.status} ${res.statusText}${
            providerMessage ? ` — ${providerMessage}` : ""
          }`,
        };
      }

      let json: {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      try {
        json = JSON.parse(raw);
      } catch (err) {
        console.error("[copilot] gemini invalid JSON", err, raw);
        return {
          ok: false as const,
          status: res.status,
          statusText: res.statusText,
          providerMessage: "",
          body: raw.slice(0, 4000),
          error: "Gemini returned a non-JSON response.",
        };
      }

      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("")
          .trim() ?? "";

      if (!text) {
        return {
          ok: false as const,
          status: res.status,
          statusText: res.statusText,
          providerMessage: "",
          body: raw.slice(0, 4000),
          error: "Gemini returned an empty response.",
        };
      }

      return { ok: true as const, text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[copilot] gemini fetch failed", err);
      return {
        ok: false as const,
        status: 0,
        statusText: "network_error",
        providerMessage: "",
        body: "",
        error: `Network error contacting Gemini: ${message}`,
      };
    }
  });

