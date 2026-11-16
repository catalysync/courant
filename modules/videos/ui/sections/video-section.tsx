"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Suspense, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { VideoBanner } from "../components/video-banner";
import { useSession } from "@/lib/auth-client";
import { VideoTopRow } from "../components/video-top-row";
import { VideoPlayer } from "../components/video-player";

interface VideoSectionProps {
  videoId: string;
}

export const VideoSection = ({ videoId }: VideoSectionProps) => {
  return (
    <Suspense fallback={<VideoSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <VideoSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoSkeleton = () => {
  return <Skeleton />;
};

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) => {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;

  const utils = trpc.useUtils();
  // const router = useRouter();
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

  const createView = trpc.videoViews.create.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId });
    },
  });

  const recordWatch = trpc.videoViews.recordWatch.useMutation();
  const lastWatchAt = useRef(0);

  const handlePlay = () => {
    if (!isSignedIn) return;

    createView.mutate({ videoId });
  };

  const handleTimeUpdate = (current: number, total: number) => {
    if (!isSignedIn) return;
    const now = Date.now();
    if (now - lastWatchAt.current < 10_000) return;
    lastWatchAt.current = now;
    recordWatch.mutate({
      videoId,
      watchSeconds: Math.floor(current),
      totalSeconds: Math.floor(total),
    });
  };

  // const onSelect = (value: string | null) => {
  //     const url = new URL(window.location.href);

  //     if (value) {
  //         url.searchParams.set("categoryId", value);
  //     } else {
  //         url.searchParams.delete("categoryId");
  //     }

  //     router.push(url.toString())
  // }
  return (
    <>
      <div
        className={cn(
          "aspect-video bg-black rounded-xl overflow-hidden relative",
          video.streamStatus !== "ready" && "rounded-b-none",
        )}
      >
        <VideoPlayer
          autoPlay
          onPlay={handlePlay}
          onTimeUpdate={handleTimeUpdate}
          uid={video.streamUid}
          thumbnailUrl={video.thumbnailUrl}
        />
      </div>
      <VideoBanner status={video.streamStatus} />
      <VideoTopRow video={video} />
    </>
  );
};
