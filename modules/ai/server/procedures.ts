import { TRPCError } from "@trpc/server";
import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";

import { database } from "@/database";
import {
  chapters,
  transcripts,
  user,
  videoEmbeddings,
  videos,
} from "@/database/schema";
import { embed, generateChapters, generateText, moderateText } from "@/lib/ai";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";

function parseEmbedding(raw: string): number[] | null {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as number[]) : null;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Parse "mm:ss" / "[mm:ss]" / "hh:mm:ss" leading timestamps into timed segments. */
function parseTranscriptSegments(text: string): { start: number; text: string }[] {
  const segments: { start: number; text: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(?:\[)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\])?[\s.\-)]*(.*)$/);
    if (m) {
      const h = 0;
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      segments.push({ start: h * 3600 + min * 60 + sec, text: m[4] ?? "" });
    } else {
      segments.push({ start: segments.length ? segments[segments.length - 1].start : 0, text: line });
    }
  }
  return segments;
}

async function assertOwner(videoId: string, userId: string) {
  const [video] = await database.select().from(videos).where(eq(videos.id, videoId));
  if (!video) throw new TRPCError({ code: "NOT_FOUND" });
  if (video.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return video;
}

export const aiRouter = createTRPCRouter({
  // ---- chapters ----

  getChapters: baseProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select()
        .from(chapters)
        .where(eq(chapters.videoId, input.videoId))
        .orderBy(asc(chapters.order), asc(chapters.startSec));
    }),

  generateChapters: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const video = await assertOwner(input.videoId, ctx.user.id);
      const [transcript] = await database
        .select({ text: transcripts.text })
        .from(transcripts)
        .where(eq(transcripts.videoId, input.videoId));

      const items = await generateChapters({
        title: video.title,
        description: video.description,
        transcript: transcript?.text ?? null,
      });

      await database.delete(chapters).where(eq(chapters.videoId, input.videoId));
      if (items.length) {
        await database.insert(chapters).values(
          items.map((c, i) => ({
            videoId: input.videoId,
            title: c.title,
            startSec: c.startSec,
            endSec: items[i + 1] ? items[i + 1].startSec : null,
            order: i,
          })),
        );
      }

      return database
        .select()
        .from(chapters)
        .where(eq(chapters.videoId, input.videoId))
        .orderBy(asc(chapters.order));
    }),

  // ---- transcript ----

  getTranscript: baseProcedure
    .input(z.object({ videoId: z.string().uuid(), language: z.string().min(2).max(10).default("en") }))
    .query(async ({ input }) => {
      const [t] = await database
        .select()
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, input.language)));
      return t ?? null;
    }),

  saveTranscript: protectedProcedure
    .input(z.object({ videoId: z.string().uuid(), text: z.string().max(200000) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(input.videoId, ctx.user.id);

      const existing = await database
        .select({ id: transcripts.id })
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, "en")));

      if (existing.length) {
        await database
          .update(transcripts)
          .set({
            text: input.text,
            segments: JSON.stringify(parseTranscriptSegments(input.text)),
            source: "manual",
            status: "draft",
            updatedAt: new Date(),
          })
          .where(eq(transcripts.id, existing[0].id));
      } else {
        await database
          .insert(transcripts)
          .values({
            videoId: input.videoId,
            language: "en",
            text: input.text,
            segments: JSON.stringify(parseTranscriptSegments(input.text)),
            source: "manual",
            status: "draft",
          });
      }

      const [t] = await database
        .select()
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, "en")));
      return t;
    }),

  // ---- embeddings / semantic search ----

  refreshEmbedding: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const video = await assertOwner(input.videoId, ctx.user.id);
      const text = `${video.title}\n${video.description ?? ""}`;
      const vector = await embed(text);
      await database
        .insert(videoEmbeddings)
        .values({
          videoId: input.videoId,
          embedding: JSON.stringify(vector),
          model: "bge-base-en-v1.5",
        })
        .onConflictDoUpdate({
          target: videoEmbeddings.videoId,
          set: { embedding: JSON.stringify(vector), updatedAt: new Date() },
        });
      return { ok: true };
    }),

  search: baseProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      try {
        const queryVector = await embed(input.query);
        const rows = await database.select().from(videoEmbeddings);

        const scored = rows
          .map((r) => {
            const e = parseEmbedding(r.embedding);
            return e ? { videoId: r.videoId, score: cosine(queryVector, e) } : null;
          })
          .filter((x): x is { videoId: string; score: number } => x !== null && x.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, input.limit);

        if (!scored.length) return { items: [], usedSemantic: true };

        const ids = scored.map((s) => s.videoId);
        const vids = await database
          .select({ ...getTableColumns(videos), user })
          .from(videos)
          .innerJoin(user, eq(videos.userId, user.id))
          .where(and(eq(videos.visibility, "public"), eq(videos.isUnlisted, false), inArray(videos.id, ids)));

        const byId = new Map(vids.map((v) => [v.id, v]));
        const ordered = scored
          .map((s) => byId.get(s.videoId))
          .filter((v): v is NonNullable<typeof v> => !!v);

        return { items: ordered, usedSemantic: true };
      } catch {
        return { items: [], usedSemantic: false };
      }
    }),

  // ---- moderation (fail-open) ----

  moderate: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      return moderateText(input.text);
    }),

  // ---- search inside video (YouTube) ----

  searchTranscript: baseProcedure
    .input(z.object({ videoId: z.string().uuid(), query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const [t] = await database
        .select()
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, "en")));
      if (!t) return { items: [] };

      const q = input.query.toLowerCase();
      let segs: { start: number; text: string }[] = [];
      if (t.segments) {
        try {
          const parsed = JSON.parse(t.segments);
          if (Array.isArray(parsed)) segs = parsed;
        } catch {
          /* fall through */
        }
      }
      if (!segs.length) segs = parseTranscriptSegments(t.text ?? "");

      const matches = segs
        .filter((s) => s.text.toLowerCase().includes(q))
        .slice(0, 30)
        .map((s) => ({ startSec: s.start, snippet: s.text.slice(0, 200) }));

      return { items: matches };
    }),

  /** Translate the English transcript to another language (Workers AI). */
  translateTranscript: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        targetLanguage: z.string().min(2).max(10), // e.g. "es", "fr", "pt"
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const video = await assertOwner(input.videoId, ctx.user.id);
      const [source] = await database
        .select()
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, "en")));
      if (!source?.text) throw new TRPCError({ code: "BAD_REQUEST", message: "No transcript to translate" });

      // Chunk to stay within model context, then translate each chunk.
      const chunks = source.text.match(/[\s\S]{1,1500}/g) ?? [source.text];
      const translated: string[] = [];
      for (const chunk of chunks) {
        const out = await generateText(
          `You are a translator. Translate the following text to language code "${input.targetLanguage}". Return only the translation, no commentary.`,
          chunk,
        );
        translated.push(out);
      }

      const text = translated.join("\n\n");
      const existing = await database
        .select({ id: transcripts.id })
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, input.targetLanguage)));

      if (existing.length) {
        await database
          .update(transcripts)
          .set({ text, source: "ai", status: "generated", updatedAt: new Date() })
          .where(eq(transcripts.id, existing[0].id));
      } else {
        await database.insert(transcripts).values({
          videoId: input.videoId,
          language: input.targetLanguage,
          text,
          source: "ai",
          status: "generated",
        });
      }

      const [t] = await database
        .select()
        .from(transcripts)
        .where(and(eq(transcripts.videoId, input.videoId), eq(transcripts.language, input.targetLanguage)));
      return t;
    }),

  /** List a video's transcripts (for the subtitle/language picker). */
  getTranscripts: baseProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .query(async ({ input }) => {
      return database
        .select({ language: transcripts.language, status: transcripts.status, source: transcripts.source })
        .from(transcripts)
        .where(eq(transcripts.videoId, input.videoId));
    }),
});