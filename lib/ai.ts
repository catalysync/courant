import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Workers AI helpers (replaces Antonio's OpenAI-based title/description/thumbnail workflows).
 * Uses the `AI` binding (env.AI) directly — no AI Gateway.
 */

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-1-schnell";

type AiBinding = {
  run(
    model: string,
    input: Record<string, unknown>,
  ): Promise<{ response?: unknown; image?: string }>;
};

function getAi(): AiBinding {
  const ctx = getCloudflareContext();
  const ai = ctx?.env?.AI as AiBinding | undefined;
  if (!ai) throw new Error("Workers AI binding `AI` is not available");
  return ai;
}

export async function generateText(system: string, prompt: string): Promise<string> {
  const ai = getAi();
  const result = await ai.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: 512,
  });
  const text = typeof result.response === "string" ? result.response : "";
  return text.trim();
}

/** Returns PNG bytes (Workers AI image models return a base64-encoded PNG). */
export async function generateImage(prompt: string): Promise<Uint8Array> {
  const ai = getAi();
  const result = await ai.run(IMAGE_MODEL, { prompt });
  const b64 = result.image;
  if (b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  throw new Error("Image generation returned no data");
}