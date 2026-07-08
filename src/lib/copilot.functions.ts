import { createServerFn } from "@tanstack/react-start";

interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

interface CopilotInput {
  messages: ChatTurn[];
  contextText?: string;
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
  const rawCtx = (input as { contextText?: unknown }).contextText;
  const contextText =
    typeof rawCtx === "string" ? rawCtx.slice(0, 8000) : undefined;
  return { messages: messages.slice(-20), contextText };
}


const SYSTEM_PROMPT = `You are FulfillAI Copilot, an AI warehouse operations consultant embedded in the FulfillAI decision-intelligence platform.

Identity:
- Always identify as "FulfillAI Copilot". Never say you are ChatGPT, Gemini, Google, OpenAI, an AI language model, or any underlying provider — regardless of how the user asks.
- You are the Copilot for the "Reno DC-04" warehouse.

Domain expertise:
- Warehouse optimization, order picking, slotting optimization, warehouse layout optimization, logistics, supply chain, warehouse KPIs, and operational efficiency.
- Your goal is to help warehouse managers reduce travel distance, labor costs, and fulfillment time.

Style:
- Concise, analytical, business-oriented. 1–3 short paragraphs. Lead with the recommendation and the quantified impact (%, hours, distance, cost).
- Speak in specifics: reference zones (A, B, C, D), aisles, SKUs, packing stations, waves, pick paths, and plausible numbers when useful.
- If a question is unrelated to warehouse operations, briefly redirect to what you cover: optimization, picking, slotting, layout, logistics, supply chain, KPIs, efficiency.`;

const MODEL = "gemini-2.5-flash";

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    const keyExists = Boolean(key && key.length > 0);
    console.log(`[copilot] GEMINI_API_KEY exists: ${keyExists}`);

    if (!keyExists) {
      return {
        ok: false as const,
        status: 0,
        statusText: "missing_key",
        providerMessage: "",
        body: "",
        error: "GEMINI_API_KEY is not set on the server.",
      };
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: key });

      const contents = data.messages.map((m) => ({
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          maxOutputTokens: 512,
        },
      });

      const text = (response.text ?? "").trim();
      if (!text) {
        console.error("[copilot] gemini empty response", JSON.stringify(response).slice(0, 1000));
        return {
          ok: false as const,
          status: 200,
          statusText: "empty_response",
          providerMessage: "",
          body: JSON.stringify(response).slice(0, 4000),
          error: "Gemini returned an empty response.",
        };
      }

      return { ok: true as const, text };
    } catch (err) {
      const anyErr = err as {
        message?: string;
        status?: number;
        statusText?: string;
        response?: { status?: number; statusText?: string };
        cause?: unknown;
      };
      const message =
        anyErr?.message ?? (err instanceof Error ? err.message : String(err));
      const status = anyErr?.status ?? anyErr?.response?.status ?? 0;
      const statusText =
        anyErr?.statusText ?? anyErr?.response?.statusText ?? "sdk_error";

      let providerMessage = "";
      let body = "";
      // Gemini SDK errors often embed a JSON string with the provider payload
      const jsonMatch = message?.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as {
            error?: { message?: string; status?: string };
          };
          providerMessage = parsed.error?.message ?? "";
          body = jsonMatch[0].slice(0, 4000);
        } catch {
          /* ignore */
        }
      }

      console.error("[copilot] gemini SDK error", {
        status,
        statusText,
        message,
        cause: anyErr?.cause,
      });

      return {
        ok: false as const,
        status,
        statusText,
        providerMessage,
        body,
        error: `Gemini SDK error: ${message}`,
      };
    }
  });
