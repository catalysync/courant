import { database } from "@/database";
import { transcripts, videos } from "@/database/schema";
import { and, eq } from "drizzle-orm";
import { VideoPlayer } from "@/modules/videos/ui/components/video-player";

export const dynamic = "force-dynamic";

// Minimal embeddable player (no app chrome) — the target of the /oembed iframe.
// Exposes the title/description/transcript in the HTML so search engines and
// LLM crawlers (ChatGPT, Perplexity) can read and attribute the video.
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  const [video] = await database
    .select({
      title: videos.title,
      description: videos.description,
      streamUid: videos.streamUid,
      thumbnailUrl: videos.thumbnailUrl,
      visibility: videos.visibility,
    })
    .from(videos)
    .where(eq(videos.id, videoId));

  if (!video || video.visibility === "private") {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-white/60 text-sm">
        Video unavailable
      </div>
    );
  }

  const [transcript] = await database
    .select({ text: transcripts.text })
    .from(transcripts)
    .where(and(eq(transcripts.videoId, videoId), eq(transcripts.language, "en")));

  return (
    <div className="w-screen h-screen bg-black">
      <VideoPlayer
        uid={video.streamUid ?? null}
        thumbnailUrl={video.thumbnailUrl ?? null}
        autoPlay
      />
      <div className="sr-only">
        <h1>{video.title}</h1>
        {video.description && <p>{video.description}</p>}
        {transcript?.text && <section aria-label="Transcript">{transcript.text}</section>}
      </div>
    </div>
  );
}