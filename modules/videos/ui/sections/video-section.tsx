"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockIcon, KeyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { VideoBanner } from "../components/video-banner";
import { useSession } from "@/lib/auth-client";
import { VideoTopRow } from "../components/video-top-row";
import { VideoPlayer } from "../components/video-player";
import { WatchParty } from "../components/watch-party";
import { ErrorState } from "@/components/error-state";
import { LeadGate } from "../components/lead-gate";

interface VideoSectionProps {
  videoId: string;
}

export const VideoSection = ({ videoId }: VideoSectionProps) => {
  return (
    <Suspense fallback={<VideoSkeleton />}>
      <ErrorBoundary fallback={<ErrorState />}>
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
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });
  const access = video.viewerAccess;

  const createView = trpc.videoViews.create.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId });
    },
  });

  const recordWatch = trpc.videoViews.recordWatch.useMutation();
  const lastWatchAt = useRef(0);

  const [verifiedSrc, setVerifiedSrc] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const verifyPassword = trpc.videos.verifyPassword.useMutation({
    onSuccess: (res) => {
      if (res?.ok && res.hlsUrl) setVerifiedSrc(res.hlsUrl);
    },
  });

  const paywall = trpc.payments.getVideoAccess.useQuery(
    { videoId },
    { enabled: access === "full" },
  );
  const checkout = trpc.payments.createVideoCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

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

  // Private / not allowed for this viewer.
  if (access === "denied") {
    return (
      <>
        <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center text-white/60 text-sm">
          <LockIcon className="size-8 mr-2" /> This video is private.
        </div>
        <VideoTopRow video={video} />
      </>
    );
  }

  // Password-protected and not yet unlocked.
  if (access === "needsPassword" && !verifiedSrc) {
    return (
      <>
        <div className="aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-4 px-6 text-center">
          <KeyIcon className="size-10 text-white/70" />
          <p className="text-white/80 text-sm">This video is password-protected</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw) verifyPassword.mutate({ videoId, password: pw });
            }}
            className="flex gap-2"
          >
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter password"
              className="max-w-xs"
              autoFocus
            />
            <Button type="submit" disabled={verifyPassword.isPending}>
              {verifyPassword.isPending ? "Checking…" : "Unlock"}
            </Button>
          </form>
          {verifyPassword.error && (
            <p className="text-red-400 text-xs">{verifyPassword.error.message}</p>
          )}
        </div>
        <VideoTopRow video={video} />
      </>
    );
  }

  const canPlay = access === "owner" || access === "full" || !!verifiedSrc;

  // Lead-gated videos require an email before playback (owners skip the gate).
  const leadGated = video.requireEmail && access !== "owner";

  // Monetized video (rental / purchase / membership) the viewer hasn't unlocked.
  if (
    access === "full" &&
    paywall.data &&
    paywall.data.monetizationType !== "free" &&
    !paywall.data.hasAccess
  ) {
    const type = paywall.data.monetizationType;
    const label =
      type === "rental" ? "Rent" : type === "purchase" ? "Buy" : "Join channel";
    const message =
      type === "membership"
        ? "This video is for channel members"
        : `This video is available to ${type}`;

    return (
      <>
        <div className="aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-4 px-6 text-center">
          <LockIcon className="size-10 text-white/70" />
          <p className="text-white/80 text-sm">{message}</p>
          <Button
            type="button"
            onClick={() => checkout.mutate({ videoId })}
            disabled={checkout.isPending}
          >
            {checkout.isPending
              ? "Redirecting…"
              : `${label} $${(paywall.data.priceCents / 100).toFixed(2)}`}
          </Button>
          {checkout.error && (
            <p className="text-red-400 text-xs">{checkout.error.message}</p>
          )}
        </div>
        <VideoTopRow video={video} />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "aspect-video bg-black rounded-xl overflow-hidden relative",
          video.streamStatus !== "ready" && "rounded-b-none",
        )}
      >
        {canPlay ? (
          <VideoPlayer
            autoPlay={!leadGated}
            onPlay={handlePlay}
            onTimeUpdate={handleTimeUpdate}
            uid={video.streamUid}
            src={verifiedSrc ?? undefined}
            thumbnailUrl={video.thumbnailUrl}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
            Loading…
          </div>
        )}
        <LeadGate video={video} />
      </div>
      <VideoBanner status={video.streamStatus} />
      {video.endScreenType !== "none" && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">
            {video.endScreenCta || "Watch next"}
          </p>
          {video.endScreenUrl && (
            <Button asChild variant="secondary" size="sm">
              <a href={video.endScreenUrl} target="_blank" rel="noreferrer">
                {video.endScreenCta || "Watch next"}
              </a>
            </Button>
          )}
        </div>
      )}
      <VideoTopRow video={video} />
      <div className="mt-4">
        <WatchParty
          videoId={videoId}
          isOwner={access === "owner"}
          duration={video.duration}
        />
      </div>
    </>
  );
};
