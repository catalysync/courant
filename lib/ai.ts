import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Workers AI helpers. Uses the `AI` binding (env.AI) directly — no AI Gateway.
 */

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-1-schnell";
const EMBED_MODEL = process.env.AI_EMBED_MODEL ?? "@cf/baai/bge-base-en-v1.5";

type AiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
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
    max_tokens: 1024,
  });
  const text = typeof result.response === "string" ? result.response : "";
  return text.trim();
}

/** Returns PNG bytes (Workers AI image models return a base64-encoded PNG). */
export async function generateImage(prompt: string): Promise<Uint8Array> {
  const ai = getAi();
  const result = await ai.run(IMAGE_MODEL, { prompt });
  const b64 = result.image;
  if (typeof b64 === "string") {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  throw new Error("Image generation returned no data");
}

/** Embed a single text into a vector. Throws when the AI binding / model is unavailable. */
export async function embed(text: string): Promise<number[]> {
  const ai = getAi();
  const result = (await ai.run(EMBED_MODEL, { text: [text] })) as {
    data?: number[][];
  };
  if (Array.isArray(result.data) && Array.isArray(result.data[0])) {
    return result.data[0];
  }
  throw new Error("Embedding returned no data");
}

function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to salvage the first {...} block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Generate chapter markers from title/description/transcript. */
export async function generateChapters(input: {
  title: string;
  description?: string | null;
  transcript?: string | null;
}): Promise<{ title: string; startSec: number }[]> {
  const prompt = `Break the following video into chapters (max 10). Return JSON only:
{"chapters":[{"title":"...","start":seconds}]}

Title: ${input.title}
Description: ${input.description ?? ""}
Transcript (may be empty): ${(input.transcript ?? "").slice(0, 4000)}`;

  const raw = await generateText(
    "You are a video chapter generator. Return valid JSON only, no commentary.",
    prompt,
  );
  const parsed = parseJson<{ chapters?: { title: string; start: number }[] }>(raw);
  const chapters = (parsed?.chapters ?? [])
    .filter((c) => typeof c.title === "string" && Number.isFinite(c.start))
    .map((c) => ({ title: c.title.slice(0, 100), startSec: Math.max(0, Math.round(c.start)) }))
    .slice(0, 10);
  return chapters;
}

/** Lightweight content moderation (fail-open). Returns flagged=false on any error. */
export async function moderateText(
  text: string,
): Promise<{ flagged: boolean; reason: string | null }> {
  try {
    const raw = await generateText(
      "You are a content moderator. Judge whether text violates basic rules (hate, harassment, spam, explicit sexual content, threats). Return JSON only: {\"flagged\": boolean, \"reason\": string or null}.",
      text.slice(0, 2000),
    );
    const parsed = parseJson<{ flagged?: boolean; reason?: string | null }>(raw);
    return {
      flagged: parsed?.flagged === true,
      reason: typeof parsed?.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return { flagged: false, reason: null };
  }
}