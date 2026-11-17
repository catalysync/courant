import type { Metadata } from "next";

import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { VideoView } from "@/modules/videos/ui/views/video-view";
import { HydrateClient, trpc } from "@/trpc/server";
import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    videoId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { videoId } = await params;
  try {
    const caller = createCallerFactory(appRouter)(createTRPCContext);
    const video = await caller.videos.getOne({ id: videoId });
    return {
      title: `${video.title} — Courant`,
      description: video.description?.slice(0, 200) ?? undefined,
      openGraph: {
        title: video.title,
        description: video.description ?? undefined,
        images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : undefined,
        type: "video.other",
      },
    };
  } catch {
    return { title: "Video — Courant" };
  }
}

const Page = async ({ params }: PageProps) => {
  const { videoId } = await params;

  void trpc.videos.getOne.prefetch({ id: videoId });
  void trpc.suggestions.getMany.prefetchInfinite({
    videoId,
    limit: PAGE_DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
};

export default Page;