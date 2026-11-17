"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ScissorsIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { VideoPlayer } from "@/modules/videos/ui/components/video-player";
import { formatTime, requestSeek } from "@/lib/playback-time";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface ClipViewProps {
  clipId: string;
}

export const ClipView = ({ clipId }: ClipViewProps) => {
  return (
    <Suspense fallback={<Skeleton className="aspect-video" />}>
      <ErrorBoundary fallback={<p>Clip not found</p>}>
        <ClipViewSuspense clipId={clipId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const ClipViewSuspense = ({ clipId }: ClipViewProps) => {
  const [clip] = trpc.community.getClip.useSuspenseQuery({ id: clipId });

  useEffect(() => {
    if (clip) requestSeek(clip.startSec);
  }, [clip]);

  if (!clip?.video) return <p className="p-6">Clip not found</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="aspect-video bg-black rounded-xl overflow-hidden">
        <VideoPlayer uid={clip.video.streamUid} thumbnailUrl={clip.video.thumbnailUrl} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <ScissorsIcon className="size-4 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-bold">
            {clip.title ?? `Clip · ${formatTime(clip.startSec)}–${formatTime(clip.endSec)}`}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatTime(clip.startSec)} → {formatTime(clip.endSec)} of{" "}
            <Link href={`/videos/${clip.video.id}`} className="text-blue-500 hover:underline">
              {clip.video.title}
            </Link>
          </p>
        </div>
      </div>
      <Link
        href={`/videos/${clip.video.id}`}
        className="mt-4 inline-flex items-center gap-2 text-sm text-blue-500 hover:underline"
      >
        <ArrowLeftIcon className="size-4" />
        Watch full video
      </Link>
    </div>
  );
};