import { database } from "@/database";
import { videos } from "@/database/schema";
import { eq } from "drizzle-orm";
import { VideoPlayer } from "@/modules/videos/ui/components/video-player";

export const dynamic = "force-dynamic";

// Minimal embeddable player (no app chrome) — the target of the /oembed iframe.
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  const [video] = await database
    .select({
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

  return (
    <div className="w-screen h-screen bg-black">
      <VideoPlayer
        uid={video.streamUid ?? null}
        thumbnailUrl={video.thumbnailUrl ?? null}
        autoPlay
      />
    </div>
  );
}
