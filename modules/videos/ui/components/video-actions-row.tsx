"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { DownloadIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STREAM_CUSTOMER_CODE } from "@/lib/stream-urls";

interface VideoActionsRowProps {
  videoId: string;
}

export const VideoActionsRow = ({ videoId }: VideoActionsRowProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <VideoActionsRowInner videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoActionsRowInner = ({ videoId }: VideoActionsRowProps) => {
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

  const downloadUrl = video.streamUid
    ? `https://customer-${STREAM_CUSTOMER_CODE}.cloudflarestream.com/${video.streamUid}/downloads/default.mp4`
    : null;

  if (!video.allowDownload && video.maturityRating !== "mature") return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {video.allowDownload && downloadUrl && (
        <Button asChild variant="secondary" size="sm">
          <a href={downloadUrl} target="_blank" rel="noreferrer">
            <DownloadIcon />
            Download
          </a>
        </Button>
      )}
      {video.maturityRating === "mature" && <Badge variant="destructive">Mature</Badge>}
    </div>
  );
};