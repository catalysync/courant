"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";
import { hlsUrl } from "@/lib/stream-urls";

interface VideoPlayerProps {
  uid?: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
  autoPlay?: boolean;
  onPlay?: () => void;
  onTimeUpdate?: (current: number, total: number) => void;
  className?: string;
}

/**
 * Cloudflare Stream player. Native HLS on Safari; hls.js everywhere else. Full control over
 * autoplay / play events (drives view counting).
 */
export const VideoPlayer = ({
  uid,
  thumbnailUrl,
  autoPlay,
  onPlay,
  onTimeUpdate,
  className,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uid) return;
    const src = hlsUrl(uid);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [uid]);

  if (!uid) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-muted-foreground text-sm">
        Video is still processing…
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={className ?? "w-full h-full object-contain"}
      poster={thumbnailUrl ?? undefined}
      autoPlay={autoPlay}
      controls
      playsInline
      preload={autoPlay ? "auto" : "metadata"}
      onPlay={onPlay}
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        onTimeUpdate?.(el.currentTime, el.duration || 0);
      }}
    />
  );
};