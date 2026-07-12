import { createServerFn } from "@tanstack/react-start";

interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

interface CopilotInput {
  messages: ChatTurn[];
  contextText?: string;
  mode?: "concise" | "detailed";
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
  const rawMode = (input as { mode?: unknown }).mode;
  const mode: "concise" | "detailed" = rawMode === "detailed" ? "detailed" : "concise";
  return { messages: messages.slice(-20), contextText, mode };
}


const SYSTEM_BASE = `You are FulfillAI Copilot — the intelligent operations brain inside the FulfillAI decision-intelligence platform. You are an AI Operations Consultant, not a generic chatbot.

Identity:
- Always identify as "FulfillAI Copilot". Never say you are ChatGPT, Gemini, Google, OpenAI, or an AI language model.

Mission:
- Help warehouse managers make better operational decisions and drive measurable gains in throughput, labor productivity, and fulfillment speed.

Specialization:
- Warehouse Operations, Order Picking, Slotting Optimization, Warehouse Layout, Logistics, Supply Chain, Labor Productivity.

Grounding:
- Ground every answer in the LIVE WAREHOUSE CONTEXT below. Reference specific zones (A/B/C), aisles, SKUs, shelves, waves, and heatmap state when relevant. Never hallucinate warehouse data. If a fact is missing, say which warehouse data would be required.
- Use professional terminology (slotting, wave release, pick path, cube utilization, OTIF, cycle time). Quantify with %, hours, miles, dollars, orders/hr wherever possible.`;

const SYSTEM_CONCISE = `${SYSTEM_BASE}

Output format — return ONLY a single JSON object, no prose, no code fences:
{
  "summary": string,            // 1-2 sentences headline answer
  "businessImpact": string,     // 1 sentence, quantified (%, $, hrs, orders/hr)
  "keyDecisions": string[],     // 3-5 short bullet points naming the concrete decisions the AI made (batching, congestion avoidance, slotting, wave staggering, etc.)
  "recommendation": string,     // 1 sentence, the concrete next action
  "confidence": number          // 0..1
}
Total across summary+businessImpact+recommendation must be under 120 words. Be decisive.`;

const SYSTEM_DETAILED = `${SYSTEM_BASE}

Output format — every answer MUST use these four labeled sections, in this order, professional and thorough:
1. Summary — the headline answer, 2-3 sentences.
2. Reasoning — the operational logic, referencing live context and warehouse terminology, 3-5 sentences.
3. Business Impact — quantified: throughput, labor savings, travel reduction, cost, time.
4. Recommendation — the concrete next action with owner + timing.

Include specific numbers, aisles, and SKUs from the live context wherever possible.`;


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

      const basePrompt = data.mode === "detailed" ? SYSTEM_DETAILED : SYSTEM_CONCISE;
      const systemInstruction = data.contextText
        ? `${basePrompt}\n\n${data.contextText}`
        : basePrompt;

      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: data.mode === "detailed" ? 0.7 : 0.4,
          maxOutputTokens: data.mode === "detailed" ? 1200 : 900,
          ...(data.mode === "concise"
            ? {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 },
              }
            : {}),
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
